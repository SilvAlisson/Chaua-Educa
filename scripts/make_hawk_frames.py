import os
import math
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

src_path = 'chaua-educa-modernizado/public/Images/predator2.png'
base = Image.open(src_path).convert('RGBA')
w, h = base.size

px_right, py_right = 370, 550
px_left, py_left = 250, 460

# 1. Right main wing mask
mask_right = Image.new('L', (w, h), 0)
d_r = ImageDraw.Draw(mask_right)
d_r.polygon([
    (280, 580), (300, 420), (340, 200), (360, 0), (980, 0),
    (980, 820), (600, 820), (450, 700), (300, 620)
], fill=255)
mask_right_soft = mask_right.filter(ImageFilter.GaussianBlur(radius=5))

right_wing = Image.new('RGBA', (w, h), (0, 0, 0, 0))
right_wing.paste(base, (0, 0), mask=mask_right_soft)

# 2. Left far wing (behind body)
mask_left = Image.new('L', (w, h), 0)
d_l = ImageDraw.Draw(mask_left)
d_l.polygon([
    (0, 140), (360, 0), (330, 200), (290, 380), (250, 460),
    (180, 480), (0, 350)
], fill=255)
mask_left_soft = mask_left.filter(ImageFilter.GaussianBlur(radius=5))
left_wing = Image.new('RGBA', (w, h), (0, 0, 0, 0))
left_wing.paste(base, (0, 0), mask=mask_left_soft)

# 3. Clean body with no far wing leftover
body = base.copy()
mask_erase_far = Image.new('L', (w, h), 255)
d_ef = ImageDraw.Draw(mask_erase_far)
d_ef.polygon([(0, 140), (320, 140), (340, 380), (320, 520), (140, 520), (0, 350)], fill=0)
mask_erase_far = mask_erase_far.filter(ImageFilter.GaussianBlur(radius=6))
body_clean = Image.new('RGBA', (w, h), (0, 0, 0, 0))
body_clean.paste(body, (0, 0), mask=mask_erase_far)

# 4. Shoulder patch for seamless joint
mask_patch = Image.new('L', (w, h), 0)
d_p = ImageDraw.Draw(mask_patch)
d_p.ellipse((220, 400, 520, 700), fill=255)
mask_patch = mask_patch.filter(ImageFilter.GaussianBlur(radius=10))
shoulder_patch = Image.new('RGBA', (w, h), (0, 0, 0, 0))
shoulder_patch.paste(base, (0, 0), mask=mask_patch)

def rotate_about_pivot(img, angle_deg, pivot):
    px, py = pivot
    pad = 400
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))
    center = (px + pad, py + pad)
    rotated = canvas.rotate(angle_deg, resample=Image.BICUBIC, center=center)
    return rotated.crop((pad, pad, pad + w, pad + h))

# Frame 0: Soaring / High Wings
hawk_0 = base.copy()

# Frame 1: Mid Flap / Forward Thrust Glide
rw_1 = rotate_about_pivot(right_wing, -20, (px_right, py_right))
lw_1 = rotate_about_pivot(left_wing, 14, (px_left, py_left))
hawk_1 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
hawk_1.paste(lw_1, (0, 0), mask=lw_1)
hawk_1.paste(body_clean, (0, 0), mask=body_clean)
hawk_1.paste(shoulder_patch, (0, 0), mask=shoulder_patch)
hawk_1.paste(rw_1, (0, 0), mask=rw_1)

# Frame 2: Downstroke Power
rw_2 = rotate_about_pivot(right_wing, -38, (px_right, py_right))
lw_2 = rotate_about_pivot(left_wing, 26, (px_left, py_left))
hawk_2 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
hawk_2.paste(lw_2, (0, 0), mask=lw_2)
hawk_2.paste(body_clean, (0, 0), mask=body_clean)
hawk_2.paste(shoulder_patch, (0, 0), mask=shoulder_patch)
hawk_2.paste(rw_2, (0, 0), mask=rw_2)

# Frame 3: Defeated / Dazed Knockout
rw_3 = rotate_about_pivot(right_wing, -12, (px_right, py_right))
lw_3 = rotate_about_pivot(left_wing, 8, (px_left, py_left))
hawk_3 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
hawk_3.paste(lw_3, (0, 0), mask=lw_3)
hawk_3.paste(body_clean, (0, 0), mask=body_clean)
hawk_3.paste(shoulder_patch, (0, 0), mask=shoulder_patch)
hawk_3.paste(rw_3, (0, 0), mask=rw_3)

# Draw dizzy spiral eye on frame 3
draw_3 = ImageDraw.Draw(hawk_3)
eye_x, eye_y = 150, 656

draw_3.ellipse((eye_x - 15, eye_y - 15, eye_x + 15, eye_y + 15), fill=(245, 245, 248, 255))
draw_3.ellipse((eye_x - 15, eye_y - 15, eye_x + 15, eye_y + 15), outline=(170, 175, 190, 255), width=2)

pts = []
for theta in np.linspace(0, 5.2 * math.pi, 90):
    r = 2.0 + (theta / (5.2 * math.pi)) * 10.5
    sx = eye_x + r * math.cos(theta)
    sy = eye_y + r * math.sin(theta)
    pts.append((sx, sy))
draw_3.line(pts, fill=(25, 30, 45, 255), width=3)

# Save images to assets/v4 as WebP
out_dirs = ['Chaua-Educa-main/assets/v4', 'dist/assets/v4']
frames = [hawk_0, hawk_1, hawk_2, hawk_3]

for out_dir in out_dirs:
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
    for i, frame in enumerate(frames):
        webp_path = os.path.join(out_dir, f'hawk-{i}.webp')
        frame.save(webp_path, 'WEBP', quality=92, method=6)
        print(f'Saved {webp_path}')

print('All 4 hawk WebP frames generated and saved to Chaua-Educa-main and dist!')
