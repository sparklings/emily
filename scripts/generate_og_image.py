import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_og_image():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), (11, 14, 23, 255)) # #0b0e17

    # 1. Background radial glow in Obsidian purple (#7c3aed)
    glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Large soft radial glow around center top
    cx, cy = 600, 180
    max_r = 450
    for r in range(max_r, 0, -10):
        alpha = int(24 * (1.0 - (r / max_r) ** 1.8))
        glow_draw.ellipse([cx - r, cy - int(r * 0.7), cx + r, cy + int(r * 0.7)], fill=(124, 58, 237, alpha))
    
    # Secondary subtle glow top left
    cx2, cy2 = 120, 80
    for r in range(250, 0, -10):
        alpha = int(18 * (1.0 - (r / 250) ** 1.5))
        glow_draw.ellipse([cx2 - r, cy2 - r, cx2 + r, cy2 + r], fill=(139, 92, 246, alpha))

    img = Image.alpha_composite(img, glow_layer)

    # 2. Subtle grid pattern
    grid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)
    grid_step = 40
    for x in range(0, W, grid_step):
        for y in range(0, H, grid_step):
            grid_draw.point((x, y), fill=(255, 255, 255, 14))
    img = Image.alpha_composite(img, grid_layer)

    draw = ImageDraw.Draw(img)

    # Fonts
    font_path_ko_b = "C:/Windows/Fonts/malgunbd.ttf"
    font_path_ko_r = "C:/Windows/Fonts/malgun.ttf"
    font_path_mono = "C:/Windows/Fonts/consola.ttf"
    font_path_mono_b = "C:/Windows/Fonts/consolab.ttf"
    font_path_en_b = "C:/Windows/Fonts/arialbd.ttf"

    font_title = ImageFont.truetype(font_path_en_b, 42)
    font_tag = ImageFont.truetype(font_path_ko_b, 13)
    font_sub_en = ImageFont.truetype(font_path_ko_b, 20)
    font_sub_ko = ImageFont.truetype(font_path_ko_r, 15)
    font_card_head = ImageFont.truetype(font_path_ko_b, 13)
    font_code = ImageFont.truetype(font_path_mono, 13)
    font_code_b = ImageFont.truetype(font_path_mono_b, 13)
    font_badge = ImageFont.truetype(font_path_ko_b, 13)
    font_chip = ImageFont.truetype(font_path_ko_b, 11)
    font_footer = ImageFont.truetype(font_path_ko_r, 13)

    # =========================================================================
    # Header Branding Area
    # =========================================================================
    top_y = 48
    left_x = 70

    # Icon Squircle Badge (56x56)
    icon_box = [left_x, top_y, left_x + 56, top_y + 56]
    # Draw glowing border for icon
    draw.rounded_rectangle([left_x - 1, top_y - 1, left_x + 57, top_y + 57], radius=16, outline=(167, 139, 250, 120), width=1)
    # Gradient or solid squircle
    draw.rounded_rectangle(icon_box, radius=15, fill=(124, 58, 237, 230))
    
    # Draw Sparkles icon inside squircle (geometric crystal sparkle)
    icx, icy = left_x + 28, top_y + 28
    # 4-point star / diamond sparkle
    sparkle_pts = [
        (icx, icy - 16), (icx + 4, icy - 4), (icx + 16, icy), (icx + 4, icy + 4),
        (icx, icy + 16), (icx - 4, icy + 4), (icx - 16, icy), (icx - 4, icy - 4)
    ]
    draw.polygon(sparkle_pts, fill=(255, 255, 255, 255))
    # Small satellite sparkle
    s_cx, s_cy = icx + 11, icy - 10
    sparkle_sm = [
        (s_cx, s_cy - 6), (s_cx + 2, s_cy - 1), (s_cx + 6, s_cy), (s_cx + 2, s_cy + 1),
        (s_cx, s_cy + 6), (s_cx - 2, s_cy + 1), (s_cx - 6, s_cy), (s_cx - 2, s_cy - 1)
    ]
    draw.polygon(sparkle_sm, fill=(255, 255, 255, 220))

    # Title & Version Badge
    title_x = left_x + 72
    draw.text((title_x, top_y + 2), "Assistant Emily", font=font_title, fill=(255, 255, 255, 255))
    
    # Version Pill Badge next to title
    badge_x = title_x + 325
    badge_y = top_y + 12
    draw.rounded_rectangle([badge_x, badge_y, badge_x + 185, badge_y + 26], radius=13, fill=(124, 58, 237, 45), outline=(139, 92, 246, 120), width=1)
    draw.text((badge_x + 14, badge_y + 4), "Obsidian Plugin · v1.1.2", font=font_tag, fill=(196, 181, 253, 255))

    # Subtitle Line
    draw.text((title_x, top_y + 54), "Obsidian AI Translation & Markdown Polish", font=font_sub_en, fill=(226, 232, 240, 240))
    draw.text((title_x + 430, top_y + 58), "· 위키링크, YAML, 수식 토큰 마스킹 보호", font=font_sub_ko, fill=(148, 163, 184, 220))

    # =========================================================================
    # Central Comparison Mockup Cards (Original vs Emily Output)
    # =========================================================================
    card_top = 155
    card_h = 320
    card_w = 485
    card_l_x = 70
    card_r_x = 1200 - 70 - card_w # 645

    # 1. Left Card: Original Markdown
    # Card outer border & background
    draw.rounded_rectangle([card_l_x, card_top, card_l_x + card_w, card_top + card_h], radius=14, fill=(18, 22, 34, 210), outline=(255, 255, 255, 25), width=1)
    
    # Left Card Header Bar
    draw.rounded_rectangle([card_l_x, card_top, card_l_x + card_w, card_top + 38], radius=14, fill=(24, 29, 44, 240))
    draw.rectangle([card_l_x, card_top + 26, card_l_x + card_w, card_top + 38], fill=(24, 29, 44, 240)) # flatten bottom corners
    draw.line([(card_l_x, card_top + 38), (card_l_x + card_w, card_top + 38)], fill=(255, 255, 255, 20), width=1)
    
    # 3 Window dots
    draw.ellipse([card_l_x + 16, card_top + 14, card_l_x + 26, card_top + 24], fill=(239, 68, 68, 200))
    draw.ellipse([card_l_x + 32, card_top + 14, card_l_x + 42, card_top + 24], fill=(245, 158, 11, 200))
    draw.ellipse([card_l_x + 48, card_top + 14, card_l_x + 58, card_top + 24], fill=(16, 185, 129, 200))
    
    draw.text((card_l_x + 72, card_top + 11), "source_document.md  (Original)", font=font_card_head, fill=(148, 163, 184, 255))
    
    # Left Card Content (Code & Markdown)
    lx = card_l_x + 22
    ly = card_top + 52
    line_spacing = 23

    # Frontmatter Box
    draw.rounded_rectangle([lx - 6, ly - 4, card_l_x + card_w - 22, ly + 68], radius=6, fill=(12, 15, 24, 150), outline=(255, 255, 255, 15), width=1)
    draw.text((lx, ly), "---", font=font_code, fill=(100, 116, 139, 255))
    draw.text((lx, ly + line_spacing * 0.9), "title: Quantum Computing Architecture", font=font_code, fill=(148, 163, 184, 255))
    draw.text((lx, ly + line_spacing * 1.8), "tags: [dev, obsidian, ai]", font=font_code, fill=(148, 163, 184, 255))
    draw.text((lx, ly + line_spacing * 2.7), "---", font=font_code, fill=(100, 116, 139, 255))

    # Body lines
    by = ly + 82
    draw.text((lx, by), "## 1. System Model [[HardwareCore]]", font=font_code_b, fill=(203, 213, 225, 255))
    draw.text((lx + 215, by), "[[HardwareCore]]", font=font_code_b, fill=(56, 189, 248, 255)) # highlight wikilink

    by += line_spacing * 1.2
    draw.text((lx, by), "The quantum state fulfills the Schrödinger equation:", font=font_code, fill=(226, 232, 240, 240))

    by += line_spacing * 1.1
    # LaTeX equation box
    draw.rounded_rectangle([lx - 4, by - 3, card_l_x + card_w - 24, by + 25], radius=5, fill=(124, 58, 237, 20), outline=(139, 92, 246, 50), width=1)
    draw.text((lx + 4, by + 1), "$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H}\\Psi(\\mathbf{r}, t)$$", font=font_code, fill=(167, 139, 250, 255))

    by += line_spacing * 1.5
    draw.text((lx, by), "0:00 · Introduction to Qubit Gates", font=font_code, fill=(148, 163, 184, 220))
    by += line_spacing * 0.9
    draw.text((lx, by), "0:45 · Hamiltonian Dynamics & Calibration", font=font_code, fill=(148, 163, 184, 220))

    # 2. Center Transfer Orb / Symbol
    cx_center = 600
    cy_center = card_top + card_h // 2
    # Glowing circle
    draw.ellipse([cx_center - 28, cy_center - 28, cx_center + 28, cy_center + 28], fill=(26, 30, 48, 255), outline=(139, 92, 246, 150), width=2)
    # Right arrow
    arrow_pts = [
        (cx_center - 10, cy_center - 8), (cx_center + 4, cy_center - 8),
        (cx_center + 4, cy_center - 13), (cx_center + 14, cy_center),
        (cx_center + 4, cy_center + 13), (cx_center + 4, cy_center + 8),
        (cx_center - 10, cy_center + 8)
    ]
    draw.polygon(arrow_pts, fill=(167, 139, 250, 255))

    # Small label under center orb
    draw.text((cx_center - 32, cy_center + 36), "1:1 정렬", font=font_chip, fill=(167, 139, 250, 220))

    # 3. Right Card: Assistant Emily Lossless Output
    # Card outer border & background with subtle purple accent border
    draw.rounded_rectangle([card_r_x, card_top, card_r_x + card_w, card_top + card_h], radius=14, fill=(20, 24, 38, 230), outline=(139, 92, 246, 90), width=1)
    
    # Right Card Header Bar
    draw.rounded_rectangle([card_r_x, card_top, card_r_x + card_w, card_top + 38], radius=14, fill=(28, 34, 52, 240))
    draw.rectangle([card_r_x, card_top + 26, card_r_x + card_w, card_top + 38], fill=(28, 34, 52, 240))
    draw.line([(card_r_x, card_top + 38), (card_r_x + card_w, card_top + 38)], fill=(139, 92, 246, 50), width=1)

    # Status Green Dot
    draw.ellipse([card_r_x + 18, card_top + 14, card_r_x + 28, card_top + 24], fill=(16, 185, 129, 255))
    draw.text((card_r_x + 36, card_top + 11), "Assistant Emily 번역 및 교열 결과 (KO)", font=font_card_head, fill=(255, 255, 255, 255))
    
    # "Token Protected" badge in top right of card
    draw.rounded_rectangle([card_r_x + card_w - 110, card_top + 8, card_r_x + card_w - 14, card_top + 30], radius=10, fill=(16, 185, 129, 30), outline=(16, 185, 129, 120), width=1)
    draw.text((card_r_x + card_w - 92, card_top + 11), "토큰 보호", font=font_chip, fill=(52, 211, 153, 255))

    # Right Card Content
    rx = card_r_x + 22
    ry = card_top + 52

    # Frontmatter Box (Preserved 100%)
    draw.rounded_rectangle([rx - 6, ry - 4, card_r_x + card_w - 22, ry + 68], radius=6, fill=(12, 15, 24, 150), outline=(52, 211, 153, 40), width=1)
    draw.text((rx, ry), "---", font=font_code, fill=(100, 116, 139, 255))
    draw.text((rx, ry + line_spacing * 0.9), "title: 양자 컴퓨팅 아키텍처", font=font_code, fill=(226, 232, 240, 255))
    draw.text((rx, ry + line_spacing * 1.8), "tags: [dev, obsidian, ai]", font=font_code, fill=(148, 163, 184, 255))
    draw.text((rx, ry + line_spacing * 2.7), "---", font=font_code, fill=(100, 116, 139, 255))

    # Body lines translated with lossless tokens
    r_by = ry + 82
    draw.text((rx, r_by), "## 1. 시스템 모델 [[HardwareCore]]", font=font_code_b, fill=(241, 245, 249, 255))
    draw.text((rx + 165, r_by), "[[HardwareCore]]", font=font_code_b, fill=(56, 189, 248, 255)) # preserved wikilink

    r_by += line_spacing * 1.2
    draw.text((rx, r_by), "양자 상태는 다음과 같이 슈뢰딩거 방정식을 충족한다:", font=font_code, fill=(226, 232, 240, 240))

    r_by += line_spacing * 1.1
    # LaTeX equation box (Preserved 100%)
    draw.rounded_rectangle([rx - 4, r_by - 3, card_r_x + card_w - 24, r_by + 25], radius=5, fill=(124, 58, 237, 25), outline=(139, 92, 246, 80), width=1)
    draw.text((rx + 4, r_by + 1), "$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\hat{H}\\Psi(\\mathbf{r}, t)$$", font=font_code, fill=(196, 181, 253, 255))

    r_by += line_spacing * 1.5
    draw.text((rx, r_by), "0:00 · 큐비트 게이트 개요", font=font_code, fill=(226, 232, 240, 240))
    r_by += line_spacing * 0.9
    draw.text((rx, r_by), "0:45 · 해밀토니안 동역학 및 캘리브레이션", font=font_code, fill=(226, 232, 240, 240))

    # Verification Chips below inside the right card
    chip_y = card_top + card_h - 38
    chips = [
        ("✓ YAML 보호", (16, 185, 129)),
        ("✓ [[WikiLink]] 보존", (14, 165, 233)),
        ("✓ LaTeX 수식 보존", (168, 85, 247)),
        ("✓ 타임스탬프 1:1 매핑", (245, 158, 11))
    ]
    cur_chip_x = rx - 4
    for label, col in chips:
        draw.rounded_rectangle([cur_chip_x, chip_y, cur_chip_x + 105, chip_y + 22], radius=11, fill=(*col, 20), outline=(*col, 90), width=1)
        draw.text((cur_chip_x + 8, chip_y + 3), label, font=font_chip, fill=(*col, 240))
        cur_chip_x += 112

    # =========================================================================
    # Bottom 3 Feature Pills
    # =========================================================================
    pill_y = 496
    pill_h = 54
    pill_w = 340
    gap = 20
    start_pill_x = 70

    pill_data = [
        ("🛡️ 마크다운 문법 토큰 보호", "YAML, [[WikiLink]], LaTeX 수식 마스킹 격리"),
        ("⚡ 로컬 LLM & 클라우드 프록시", "Ollama · LM Studio · FreeLLMAPI · Gemini"),
        ("🌐 단락별 1:1 대조 번역", "학술체·경어체 정합 & 맞춤법·문법 스마트 교열")
    ]

    for idx, (title, desc) in enumerate(pill_data):
        px = start_pill_x + idx * (pill_w + gap)
        draw.rounded_rectangle([px, pill_y, px + pill_w, pill_y + pill_h], radius=12, fill=(18, 22, 34, 200), outline=(255, 255, 255, 20), width=1)
        draw.text((px + 16, pill_y + 10), title, font=font_badge, fill=(248, 250, 252, 255))
        draw.text((px + 16, pill_y + 30), desc, font=font_chip, fill=(148, 163, 184, 220))

    # =========================================================================
    # Clean Footer
    # =========================================================================
    foot_y = 578
    draw.text((70, foot_y), "github.com/sparklings/emily", font=font_footer, fill=(148, 163, 184, 220))
    draw.text((290, foot_y), "·  Obsidian Knowledge Management AI Assistant  ·  GPL-3.0 License", font=font_footer, fill=(100, 116, 139, 220))

    # Convert to RGB and save
    final_img = Image.new("RGB", (W, H), (11, 14, 23))
    final_img.paste(img, (0, 0), img)

    # Save PNG
    out_png = "docs/og-image.png"
    final_img.save(out_png, format="PNG", optimize=True)
    print(f"Saved {out_png} successfully: {os.path.getsize(out_png)} bytes")

    # Save JPG
    out_jpg = "docs/og-image.jpg"
    final_img.save(out_jpg, format="JPEG", quality=95, optimize=True)
    print(f"Saved {out_jpg} successfully: {os.path.getsize(out_jpg)} bytes")

if __name__ == "__main__":
    create_og_image()
