# Test data

Sample assets for manual and automated testing (inventory, recipe generation, recipe saving).

## Directory layout

- **`fixtures/`** – Test photos for inventory and recipe flows.

### Fixture images (included)

| File | Product |
|------|--------|
| `wonderful-pistachios-roasted-salted.png` | Wonderful pistachios (roasted & salted, 6 oz) |
| `heb-prune-juice.png` | H-E-B Select Ingredients 100% Prune Juice (64 fl oz) |
| `kirkland-tuna-pantry-shelf.png` | Kirkland Albacore Tuna + pantry shelf (tuna, black beans, chickpeas, etc.) |
| `heb-garbanzo-beans.png` | H-E-B Garbanzo Beans (15.5 oz) |
| `central-market-organics-garbanzo-beans.png` | Central Market Organics Low Sodium Garbanzo Beans (15.5 oz) |
| `kelleys-honey-wildflower.png` | Kelley's Local Texas Wildflower Raw & Unfiltered Honey (40 oz) |

## Using test photos

### iOS Simulator

1. **Add photos to the simulator**
   - Drag and drop image files from `test-data/fixtures/` onto the Simulator window, or  
   - In Simulator: **File → Open Simulator → Photo Library** (or use the Photos app) and add/save images.

2. **In the app**
   - **Inventory** → use “Pick from library” / “Choose photo” (or the equivalent action that opens the image picker).
   - Select one of the test photos you added.
   - The app will process the image (OCR/product recognition) and you can add items to inventory, then use **Recipes** for recipe generation and **Recipe Box** for saving.

### Suggested test flows

- **Add to inventory:** Inventory → Pick from library → choose a fixture photo → confirm/edit items → add.
- **Recipe generation:** After adding inventory (or with existing items), open **Recipes** → generate recipes from pantry.
- **Recipe saving:** Open a generated recipe → save to Recipe Box; then open **Recipe Box** to confirm it’s saved.

### E2E / scripts

- Fixture paths: `test-data/fixtures/` (relative to repo root).
- For E2E that uses the simulator photo library, load these images into the simulator (e.g. via a script or manual step) before running tests that rely on “Pick from library”.
