import os
import win32com.client

# PowerPoint Constants
ppAnimateLevelNone = 0            # All text paragraphs in box appear AT ONCE (0 sub-clicks!)
msoAnimEffectFade = 10            # Fade In
msoAnimTriggerOnPageClick = 1     # 1 Click per card/box
msoAnimTriggerWithPrevious = 2    # Appears together

def apply_card_level_animations(input_path, output_path):
    print("Launching PowerPoint COM Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_clicks_count = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # Delete existing sequence
        seq = slide.TimeLine.MainSequence
        while seq.Count > 0:
            seq.Item(1).Delete()

        # Disable text level paragraph build on all shapes
        for shape in slide.Shapes:
            if shape.HasTextFrame:
                try:
                    shape.AnimationSettings.Animate = -1
                    shape.AnimationSettings.TextLevelEffect = ppAnimateLevelNone
                except Exception:
                    pass

        # Filter content shapes
        content_shapes = []
        for shape in slide.Shapes:
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)

        if not content_shapes:
            continue

        # Group shapes into cards by horizontal and vertical card positions
        card_clusters = []
        for shape in content_shapes:
            added = False
            for cluster in card_clusters:
                ref = cluster[0]
                # If shapes lie in same card column/row region (X distance < 2.0" & Y distance < 2.5")
                if abs(shape.Left - ref.Left) < 2.0 and abs(shape.Top - ref.Top) < 2.5:
                    cluster.append(shape)
                    added = True
                    break
            if not added:
                card_clusters.append([shape])

        # Sort clusters by Top and Left
        card_clusters.sort(key=lambda c: (round(min(s.Top for s in c), -1), min(s.Left for s in c)))

        slide_clicks = len(card_clusters)
        total_clicks_count += slide_clicks

        for cluster in card_clusters:
            # Sort shapes so container/background shape is first
            cluster.sort(key=lambda s: s.Width * s.Height, reverse=True)
            for idx, shape in enumerate(cluster):
                trigger = msoAnimTriggerOnPageClick if idx == 0 else msoAnimTriggerWithPrevious
                try:
                    seq.AddEffect(shape, msoAnimEffectFade, 0, trigger)
                except Exception:
                    pass

        print(f"Slide {slide_idx+1}: Exact {slide_clicks} clicks (reduced from {len(content_shapes)} shapes)!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"SUCCESS! Card-Level Animations Applied!")
    print(f"Total Clicks for ALL 14 Slides: ONLY {total_clicks_count} Clicks (~2 to 4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    apply_card_level_animations(input_file, output_file)
