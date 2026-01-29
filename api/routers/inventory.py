"""Inventory CRUD, expiring/expired, process-image, refresh."""

import logging
import shutil
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.exc import IntegrityError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from api.config import config
from api.dependencies import get_current_user, get_db, get_pantry_service
from api.limiter import limiter
from api.models import (
    ConsumeRequest,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    MessageResponse,
)
from api.utils import _SCHEMA_ERROR_MSG, detail_for_db_error, enrich_inventory_item
from src.ai_analyzer import create_ai_analyzer
from src.database import User
from src.db_service import PantryService
from src.file_validation import validate_image_file
from src.ocr_service import create_ocr_service
from src.security_logger import get_client_ip, get_user_agent, log_security_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Inventory"])


@router.get("/inventory", response_model=List[InventoryItemResponse])
@limiter.limit("100/minute")
def get_inventory(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    location: Optional[str] = Query(None),
    item_status: Optional[str] = Query(None, alias="status"),
    pantry_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> List[Dict[str, Any]]:
    """Get inventory items with optional filtering and pagination (DB-level)."""
    try:
        if pantry_id is None and current_user:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        items = service.get_inventory_paginated(
            user_id=current_user.id if current_user else None,
            pantry_id=pantry_id,
            skip=skip,
            limit=limit,
            location=location,
            item_status=item_status,
        )
        result = [enrich_inventory_item(i) for i in items]
        logger.info("Retrieved %d inventory items", len(result))
        return result
    except Exception as e:
        logger.error("Error retrieving inventory: %s", e)
        raise HTTPException(
            status_code=500,
            detail=detail_for_db_error(e, "Failed to retrieve inventory"),
        ) from e


@router.post("/inventory/process-image")
@limiter.limit("10/minute")
def process_single_image(
    request: Request,
    file: UploadFile = File(...),
    storage_location: str = Form("pantry"),
    pantry_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Process a single uploaded image through OCR and AI analysis."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    tmp_path: Optional[Path] = None
    try:
        if storage_location not in ("pantry", "fridge", "freezer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="storage_location must be one of: pantry, fridge, freezer",
            )
        try:
            validate_image_file(file)
        except HTTPException as e:
            log_security_event(
                db=db, event_type="file_upload_validation_failed", user_id=current_user.id,
                ip_address=ip_address,
                details={"filename": file.filename, "content_type": file.content_type, "error": str(e.detail)},
                severity="warning", user_agent=user_agent,
            )
            raise
        except Exception as e:
            logger.error("File validation error: %s", e, exc_info=True)
            log_security_event(
                db=db, event_type="file_upload_validation_error", user_id=current_user.id,
                ip_address=ip_address, details={"filename": file.filename, "error": str(e)},
                severity="error", user_agent=user_agent,
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File validation failed: {str(e)}") from e
        try:
            suffix = Path(file.filename).suffix if file.filename else ".jpg"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                tmp_path = Path(tmp_file.name)
        except Exception as e:
            logger.error("Error saving uploaded file: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save uploaded file: {str(e)}",
            ) from e
        try:
            try:
                ocr_service = create_ocr_service()
            except Exception as e:
                logger.error("Failed to initialize OCR service: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OCR service unavailable: {str(e)}",
                ) from e
            try:
                ai_analyzer = create_ai_analyzer()
            except Exception as e:
                logger.error("Failed to initialize AI analyzer: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI analyzer unavailable: {str(e)}",
                ) from e
            logger.info("Processing image: %s", file.filename)
            if not tmp_path or not tmp_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to save uploaded image file",
                )
            try:
                ocr_result = ocr_service.extract_text(str(tmp_path))
            except Exception as e:
                logger.error("OCR extraction failed: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OCR extraction failed: {str(e)}",
                ) from e
            ocr_confidence = ocr_result.get("confidence", 0)
            if not ocr_result.get("raw_text", "").strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No text extracted from image. Please ensure the image contains readable product labels.",
                )
            try:
                product_data = ai_analyzer.analyze_product(ocr_result)
                ai_confidence = product_data.confidence
            except Exception as e:
                logger.error("AI analysis failed: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI analysis failed: {str(e)}",
                ) from e
            if not product_data.product_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not identify product from image. Please try a clearer image.",
                )
            product = service.add_product(
                product_name=product_data.product_name,
                brand=product_data.brand,
                category=product_data.category or "Other",
                subcategory=product_data.subcategory,
            )
            exp_date = None
            if product_data.expiration_date:
                try:
                    date_str = str(product_data.expiration_date).replace("Z", "+00:00")
                    exp_date = datetime.fromisoformat(date_str).date()
                except (ValueError, AttributeError, TypeError):
                    exp_date = None
            if pantry_id is not None:
                pantry = service.get_pantry(pantry_id, current_user.id)
                if not pantry:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pantry not found or access denied")
                target_pantry_id = pantry_id
            else:
                default_pantry = service.get_or_create_default_pantry(current_user.id)
                target_pantry_id = default_pantry.id
            item = service.add_inventory_item(
                product_id=product.id, quantity=1.0, unit="count",
                storage_location=storage_location, expiration_date=exp_date,
                image_path=file.filename, notes="Processed from uploaded image",
                user_id=current_user.id, pantry_id=target_pantry_id,
            )
            service.add_processing_log(
                image_path=file.filename, ocr_confidence=ocr_confidence, ai_confidence=ai_confidence,
                status="success" if ai_confidence >= 0.6 else "manual_review",
                raw_ocr_data=ocr_result, raw_ai_data=product_data.to_dict(), inventory_item_id=item.id,
            )
            service.session.refresh(item)
            result = enrich_inventory_item(item)
            logger.info("Successfully processed image: %s", product_data.product_name)
            log_security_event(
                db=db, event_type="file_upload_success", user_id=current_user.id,
                ip_address=ip_address,
                details={"filename": file.filename, "product_name": product_data.product_name, "ocr_confidence": ocr_confidence, "ai_confidence": ai_confidence},
                severity="info", user_agent=user_agent,
            )
            return {
                "success": True,
                "message": f"Successfully processed {product_data.product_name}",
                "item": result,
                "confidence": {"ocr": ocr_confidence, "ai": ai_confidence, "combined": (ocr_confidence + ai_confidence) / 2},
            }
        finally:
            if tmp_path and tmp_path.exists():
                tmp_path.unlink()
    except HTTPException as e:
        log_security_event(
            db=db, event_type="file_upload_failed",
            user_id=current_user.id,
            ip_address=ip_address,
            details={"filename": file.filename if file else None, "error": str(getattr(e, "detail", e)), "status_code": getattr(e, "status_code", None)},
            severity="warning", user_agent=user_agent,
        )
        raise
    except (IntegrityError, ProgrammingError, SQLAlchemyError) as e:
        err_msg = str(e).lower()
        logger.error("Error processing image (DB): %s", e, exc_info=True)
        log_security_event(
            db=db, event_type="file_upload_error",
            user_id=current_user.id,
            ip_address=ip_address,
            details={"filename": file.filename if file else None, "error": err_msg[:500]},
            severity="error", user_agent=user_agent,
        )
        if "does not exist" in err_msg or "undefinedcolumn" in err_msg or "storage_location" in err_msg or "inventory_items" in err_msg:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_SCHEMA_ERROR_MSG) from e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save inventory item. Please try again.") from e
    except Exception as e:
        logger.error("Error processing image: %s", e, exc_info=True)
        log_security_event(
            db=db, event_type="file_upload_error",
            user_id=current_user.id,
            ip_address=ip_address,
            details={"filename": file.filename if file else None, "error": str(e)[:500]},
            severity="error", user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to process image. Please try again."),
        ) from e


@router.post("/inventory/refresh")
def refresh_inventory(
    body: Dict[str, Any] = Body(default_factory=dict),
    service: PantryService = Depends(get_pantry_service),
) -> Dict[str, Any]:
    """Refresh inventory by processing all images in the source directory."""
    try:
        source_directory = body.get("source_directory")
        storage_location = body.get("storage_location", "pantry")
        min_confidence = body.get("min_confidence", 0.6)
        if storage_location not in ("pantry", "fridge", "freezer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="storage_location must be one of: pantry, fridge, freezer",
            )
        if not isinstance(min_confidence, (int, float)) or min_confidence < 0.0 or min_confidence > 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_confidence must be between 0.0 and 1.0",
            )
        if not source_directory:
            source_directory = config.source_images_dir
        source_dir = Path(source_directory).expanduser().resolve()
        if not source_dir.exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Source directory does not exist: {source_directory}")
        if not source_dir.is_dir():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Path is not a directory: {source_directory}")
        image_files = sorted(list(source_dir.glob("*.jpg")) + list(source_dir.glob("*.jpeg")))
        if not image_files:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No images found in {source_directory}")
        ocr_service = create_ocr_service()
        ai_analyzer = create_ai_analyzer()
        existing_logs = service.get_processing_logs(limit=10000)
        processed_images = {log.image_path for log in existing_logs if log.image_path}
        results = {"processed": 0, "skipped": 0, "failed": 0, "items_created": 0, "items_updated": 0, "errors": []}
        for image_path in image_files:
            image_name = image_path.name
            if image_name in processed_images:
                results["skipped"] += 1
                continue
            try:
                ocr_result = ocr_service.extract_text(str(image_path))
                ocr_confidence = ocr_result.get("confidence", 0)
                if not ocr_result.get("raw_text", "").strip():
                    results["skipped"] += 1
                    continue
                product_data = ai_analyzer.analyze_product(ocr_result)
                ai_confidence = product_data.confidence
                if ai_confidence < min_confidence or not product_data.product_name:
                    results["skipped"] += 1
                    continue
                product = service.add_product(
                    product_name=product_data.product_name, brand=product_data.brand,
                    category=product_data.category or "Other", subcategory=product_data.subcategory,
                )
                exp_date = None
                if product_data.expiration_date:
                    try:
                        exp_date = datetime.fromisoformat(
                            str(product_data.expiration_date).replace("Z", "+00:00")
                        ).date()
                    except (ValueError, AttributeError):
                        pass
                item = service.add_inventory_item(
                    product_id=product.id, quantity=1.0, unit="count", storage_location=storage_location,
                    expiration_date=exp_date, image_path=image_name,
                    notes=f"Processed from {source_directory}",
                )
                service.add_processing_log(
                    image_path=image_name, ocr_confidence=ocr_confidence, ai_confidence=ai_confidence,
                    status="success" if ai_confidence >= 0.6 else "manual_review",
                    raw_ocr_data=ocr_result, raw_ai_data=product_data.to_dict(), inventory_item_id=item.id,
                )
                results["processed"] += 1
                results["items_created"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"image": image_name, "error": str(e)})
                logger.error("Error processing %s: %s", image_name, e)
        logger.info("Refresh complete: %s processed, %s skipped, %s failed", results["processed"], results["skipped"], results["failed"])
        return {"success": True, "message": f"Processed {results['processed']} images", "source_directory": str(source_dir), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error refreshing inventory: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh inventory: {str(e)}",
        ) from e


@router.get("/inventory/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(
    item_id: int,
    service: PantryService = Depends(get_pantry_service),
) -> Dict[str, Any]:
    """Get a specific inventory item by ID."""
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found",
            )
        return enrich_inventory_item(item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving inventory item %s: %s", item_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to retrieve inventory item"),
        ) from e


@router.post(
    "/inventory",
    response_model=InventoryItemResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
def create_inventory_item(
    request: Request,
    item_data: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict[str, Any]:
    """Add a new inventory item."""
    try:
        product = service.get_product(item_data.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item_data.product_id} not found",
            )
        pantry_id = item_data.pantry_id
        if pantry_id is None:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        item = service.add_inventory_item(
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit=item_data.unit,
            purchase_date=item_data.purchase_date,
            expiration_date=item_data.expiration_date,
            storage_location=item_data.storage_location,
            image_path=item_data.image_path,
            notes=item_data.notes,
            status=getattr(item_data, "status", "in_stock"),
            user_id=current_user.id,
            pantry_id=pantry_id,
        )
        logger.info("Created inventory item ID %s", item.id)
        return enrich_inventory_item(item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating inventory item: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to create inventory item"),
        ) from e


@router.put("/inventory/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    item_id: int,
    item_data: InventoryItemUpdate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict[str, Any]:
    """Update an existing inventory item."""
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found",
            )
        if item.user_id and item.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own inventory items",
            )
        update_data = item_data.model_dump(exclude_unset=True)
        if "purchase_date" in update_data and update_data["purchase_date"]:
            if isinstance(update_data["purchase_date"], date):
                update_data["purchase_date"] = update_data["purchase_date"].isoformat()
        if "expiration_date" in update_data and update_data["expiration_date"]:
            if isinstance(update_data["expiration_date"], date):
                update_data["expiration_date"] = update_data["expiration_date"].isoformat()
        if "product_id" in update_data:
            if not service.get_product(update_data["product_id"]):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {update_data['product_id']} not found",
                )
        if "pantry_id" in update_data and update_data["pantry_id"] is not None:
            if not service.get_pantry(update_data["pantry_id"], current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pantry with ID {update_data['pantry_id']} not found",
                )
        updated_item = service.update_inventory_item(item_id, **update_data)
        logger.info("Updated inventory item ID %s", item_id)
        return enrich_inventory_item(updated_item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating inventory item %s: %s", item_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to update inventory item"),
        ) from e


@router.delete("/inventory/{item_id}", response_model=MessageResponse)
def delete_inventory_item(
    item_id: int,
    service: PantryService = Depends(get_pantry_service),
) -> MessageResponse:
    """Delete an inventory item."""
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found",
            )
        service.session.delete(item)
        service.session.commit()
        logger.info("Deleted inventory item ID %s", item_id)
        return MessageResponse(message=f"Inventory item {item_id} deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        service.session.rollback()
        logger.error("Error deleting inventory item %s: %s", item_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to delete inventory item"),
        ) from e


@router.post("/inventory/{item_id}/consume", response_model=InventoryItemResponse)
def consume_inventory_item(
    item_id: int,
    consume_data: Optional[ConsumeRequest] = None,
    service: PantryService = Depends(get_pantry_service),
) -> Dict[str, Any]:
    """Consume an inventory item."""
    try:
        quantity = consume_data.quantity if consume_data else None
        item = service.consume_item(item_id, quantity)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found",
            )
        logger.info("Consumed inventory item ID %s", item_id)
        return enrich_inventory_item(item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.error("Error consuming inventory item %s: %s", item_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to consume inventory item"),
        ) from e


@router.get("/expiring", response_model=List[InventoryItemResponse])
@limiter.limit("100/minute")
def get_expiring_items(
    request: Request,
    days: int = Query(7, ge=1, le=365),
    service: PantryService = Depends(get_pantry_service),
) -> List[Dict[str, Any]]:
    """Get items expiring within specified days."""
    try:
        items = service.get_expiring_items(days)
        result = [enrich_inventory_item(i) for i in items]
        logger.info("Found %d items expiring within %d days", len(result), days)
        return result
    except Exception as e:
        logger.error("Error retrieving expiring items: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to retrieve expiring items"),
        ) from e


@router.get("/expired", response_model=List[InventoryItemResponse])
def get_expired_items(
    service: PantryService = Depends(get_pantry_service),
) -> List[Dict[str, Any]]:
    """Get all expired items."""
    try:
        items = service.get_expired_items()
        result = [enrich_inventory_item(i) for i in items]
        logger.info("Found %d expired items", len(result))
        return result
    except Exception as e:
        logger.error("Error retrieving expired items: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, "Failed to retrieve expired items"),
        ) from e
