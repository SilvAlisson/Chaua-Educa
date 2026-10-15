import os
from PIL import Image
import numpy as np
from collections import deque

BRAIN_DIR = r"C:\Users\aliss\.gemini\antigravity\brain\ed57b9d7-6392-4a2f-9a94-60455156b763"
USER_UPLOAD_DIR = os.path.join(BRAIN_DIR, ".user_uploaded")
PUBLIC_ASSETS = r"c:\Users\aliss\Desktop\Nova pasta\TESTE - Copia\public\assets\v2"

os.makedirs(PUBLIC_ASSETS, exist_ok=True)

def extract_alpha(img_path, threshold=20, feather=10):
    img = Image.open(img_path).convert("RGB")
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape
    
    # Distance from pure white
    diff = np.max(255.0 - arr, axis=2)
    
    # Connected component flood fill from borders to isolate exterior background
    mask = diff < (threshold + feather)
    visited = np.zeros((h, w), dtype=bool)
    
    q = deque()
    for x in range(w):
        if mask[0, x]: q.append((0, x)); visited[0, x] = True
        if mask[h-1, x]: q.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if mask[y, 0] and not visited[y, 0]: q.append((y, 0)); visited[y, 0] = True
        if mask[y, w-1] and not visited[y, w-1]: q.append((y, w-1)); visited[y, w-1] = True
        
    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and mask[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
                
    alpha = np.ones((h, w), dtype=np.float32) * 255.0
    outside_ramp = np.clip((diff - threshold) / feather, 0.0, 1.0) * 255.0
    alpha[visited] = outside_ramp[visited]
    
    # Defringe / decontaminate edges
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    a_norm = np.clip(alpha / 255.0, 0.001, 1.0)
    for c in range(3):
        clean = (arr[:, :, c] - (1.0 - a_norm) * 255.0) / a_norm
        rgba[:, :, c] = np.clip(clean, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha.astype(np.uint8)
    
    res = Image.fromarray(rgba, "RGBA")
    bbox = res.getbbox()
    if bbox:
        res = res.crop(bbox)
    return res

def process_fruits():
    # User-uploaded fruits (already transparent PNGs)
    banana = Image.open(os.path.join(USER_UPLOAD_DIR, "media_1792025306041_a362abd8.png")).convert("RGBA")
    banana = banana.crop(banana.getbbox())
    banana.thumbnail((256, 256), Image.Resampling.LANCZOS)
    banana.save(os.path.join(PUBLIC_ASSETS, "fruit-Banana.png"))
    print("Saved fruit-Banana.png", banana.size)

    milho = Image.open(os.path.join(USER_UPLOAD_DIR, "media_1792025336505_03f8bc3b.png")).convert("RGBA")
    milho = milho.crop(milho.getbbox())
    milho.thumbnail((256, 256), Image.Resampling.LANCZOS)
    milho.save(os.path.join(PUBLIC_ASSETS, "fruit-Milho.png"))
    print("Saved fruit-Milho.png", milho.size)

    # Generated fruits (need alpha extraction)
    fruit_sources = {
        "fruit-Goiaba.png": os.path.join(BRAIN_DIR, "clay_brazilian_guava_no_shadow_1792025845255.jpg"),
        "fruit-Manga.png": os.path.join(BRAIN_DIR, "claymation_mango_1792026004969.jpg"),
        "fruit-Mamao.png": os.path.join(BRAIN_DIR, "papaya_claymation_1792025988019.jpg"),
        "fruit-Coquinho.png": os.path.join(BRAIN_DIR, "clay_licuri_nuts_png_1792025987334.jpg"),
        "fruit-Semente.png": os.path.join(BRAIN_DIR, "native_forest_seed_claymation_clean_1792026013589.jpg"),
    }

    for name, src in fruit_sources.items():
        extracted = extract_alpha(src)
        extracted.thumbnail((256, 256), Image.Resampling.LANCZOS)
        extracted.save(os.path.join(PUBLIC_ASSETS, name))
        print(f"Saved {name}", extracted.size)

def process_trunks():
    src = os.path.join(BRAIN_DIR, "clay_tree_trunk_obstacle_1792026022270.jpg")
    trunk = extract_alpha(src, threshold=24, feather=12)
    # Resize trunk for optimal in-game crispness (e.g. 180px wide by 600px tall)
    w, h = trunk.size
    target_w = 180
    target_h = int(h * (target_w / w))
    trunk_scaled = trunk.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Save standard trunk (cut cap on top, for bottom obstacle)
    trunk_scaled.save(os.path.join(PUBLIC_ASSETS, "trunk-clay.png"))
    print("Saved trunk-clay.png", trunk_scaled.size)
    
    # Save inverted trunk (cut cap on bottom, for top obstacle)
    trunk_top = trunk_scaled.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    trunk_top.save(os.path.join(PUBLIC_ASSETS, "trunk-clay-top.png"))
    print("Saved trunk-clay-top.png", trunk_top.size)

def process_bird():
    # User-uploaded bird poses
    down_raw = Image.open(os.path.join(USER_UPLOAD_DIR, "media_1792025318186_60a97459.png")).convert("RGBA")
    up_raw = Image.open(os.path.join(USER_UPLOAD_DIR, "media_1792025325250_0947b977.png")).convert("RGBA")
    
    down_crop = down_raw.crop(down_raw.getbbox())
    up_crop = up_raw.crop(up_raw.getbbox())
    
    # Scale up_crop to match down_crop's head size (factor ~1.466)
    up_w, up_h = up_crop.size
    up_scaled = up_crop.resize((int(up_w * 1.466), int(up_h * 1.466)), Image.Resampling.LANCZOS)
    
    # Fit into normalized 256x256 sprite canvas for crisp rendering
    # Target size ~128px displayed in game
    down_final = down_crop.copy()
    down_final.thumbnail((256, 256), Image.Resampling.LANCZOS)
    
    scale_ratio = down_final.size[0] / down_crop.size[0]
    up_final = up_scaled.resize(
        (int(up_scaled.size[0] * scale_ratio), int(up_scaled.size[1] * scale_ratio)),
        Image.Resampling.LANCZOS
    )
    
    # Save both poses
    down_final.save(os.path.join(PUBLIC_ASSETS, "chaua-clay-glide.png"))
    up_final.save(os.path.join(PUBLIC_ASSETS, "chaua-clay-flap.png"))
    print("Saved chaua-clay-glide.png", down_final.size)
    print("Saved chaua-clay-flap.png", up_final.size)

def process_background():
    src = os.path.join(BRAIN_DIR, "tropical_forest_claymation_bg_1792026040620.jpg")
    bg = Image.open(src).convert("RGB")
    # Resize to standard 1920x1080 resolution
    bg_resized = bg.resize((1920, 1080), Image.Resampling.LANCZOS)
    bg_resized.save(os.path.join(PUBLIC_ASSETS, "forest-clay-backdrop.png"), quality=95)
    print("Saved forest-clay-backdrop.png", bg_resized.size)

if __name__ == "__main__":
    print("--- Processing all Clay Assets ---")
    process_fruits()
    process_trunks()
    process_bird()
    process_background()
    print("--- All Clay Assets Successfully Processed! ---")
