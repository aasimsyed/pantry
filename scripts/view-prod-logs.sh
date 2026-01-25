#!/bin/bash
# View production Cloud Run logs (tail or recent) and open Logging in browser.
# Uses same project/region/service as deploy-cloud-run.sh.

set -e

PROJECT_ID="${GCP_PROJECT_ID:-pantry-manager-416004}"
REGION="${GCP_REGION:-us-south1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-pantry-api}"

# Logging URL: Cloud Run service → Logs tab (project + region + service)
LOGGING_URL="https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/logs?project=${PROJECT_ID}"

# Logs Explorer with filters (errors only)
EXPLORER_URL="https://console.cloud.google.com/logging/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22${SERVICE_NAME}%22%0Aseverity%3E%3DERROR;project=${PROJECT_ID}"

usage() {
    echo "Usage: $0 [tail|read|open|open-errors]"
    echo ""
    echo "  tail         Stream logs in real time (default)"
    echo "  read         Show last 100 lines"
    echo "  open         Open Cloud Run Logs tab in browser"
    echo "  open-errors  Open Logs Explorer filtered to errors only"
    echo ""
    echo "Env: GCP_PROJECT_ID, GCP_REGION, CLOUD_RUN_SERVICE (defaults: pantry-manager-416004, us-south1, pantry-api)"
    exit 0
}

case "${1:-tail}" in
    tail)
        echo "Tailing Cloud Run logs: ${SERVICE_NAME} (${REGION})"
        echo "Logging URL: ${LOGGING_URL}"
        echo "---"
        gcloud run services logs tail "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}"
        ;;
    read)
        echo "Recent logs: ${SERVICE_NAME} (${REGION})"
        echo "Logging URL: ${LOGGING_URL}"
        echo "---"
        gcloud run services logs read "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --limit 100
        ;;
    open)
        echo "Opening Cloud Run Logs: ${LOGGING_URL}"
        open "${LOGGING_URL}" 2>/dev/null || xdg-open "${LOGGING_URL}" 2>/dev/null || echo "Open: ${LOGGING_URL}"
        ;;
    open-errors)
        echo "Opening Logs Explorer (errors): ${EXPLORER_URL}"
        open "${EXPLORER_URL}" 2>/dev/null || xdg-open "${EXPLORER_URL}" 2>/dev/null || echo "Open: ${EXPLORER_URL}"
        ;;
    -h|--help)
        usage
        ;;
    *)
        echo "Unknown: $1"
        usage
        ;;
esac
