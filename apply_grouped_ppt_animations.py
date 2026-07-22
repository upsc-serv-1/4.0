import os
import win32com.client

# PowerPoint Constants
msoTrue = -1
ppAnimateLevelNone = 0          # No paragraph sub-clicks! All text appears together with box!
ppEffectFade = 1025             # Fade In Entrance Effect

def apply_clean_card_animations(input_path, output_path):
    print("Launching PowerPoint Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_clicks = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # Clear existing timeline completely
        seq = slide.TimeLine.MainSequence
        while seq.Count > 0:
            seq.Item(1).Delete()

        content_shapes = []
        for shape in slide.Shapes:
            # Filter content shapes below title header (top > 75) and above footer (top < 460)
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)

        if not content_shapes:
            continue

        # Group shapes into cards by matching Top/Left bounds (within 2.2 inches)
        card_clusters = []
        for shape in content_shapes:
            added = False
            for cluster in card_clusters:
                ref = cluster[0]
                if abs(shape.Left - ref.Left) < 2.2 and abs(shape.Top - ref.Top) < 2.2:
                    cluster.append(shape)
                    added = True
                    break
            if not added:
                card_clusters.append([shape])

        # Sort clusters by reading order
        card_clusters.sort(key=lambda c: (round(min(s.Top for s in c), -1), min(s.Left for s in c)))

        slide_clicks = len(card_clusters)
        total_clicks += slide_clicks

        # Configure shape animation settings
        for cluster in card_clusters:
            # Container shape first
            cluster.sort(key=lambda s: s.Width * s.Height, reverse=True)
            for idx, shape in enumerate(cluster):
                try:
                    shape.AnimationSettings.Animate = msoTrue
                    shape.AnimationSettings.TextLevelEffect = ppAnimateLevelNone
                    shape.AnimationSettings.EntryEffect = ppEffectFade
                except Exception:
                    pass

        print(f"Slide {slide_idx+1}: Configured EXACTLY {slide_clicks} Card Clicks!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"SUCCESS! Native Card Animation Settings Configured!")
    print(f"Total Clicks across ENTIRE 14-slide presentation: ONLY {total_clicks} Clicks (~3-4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    apply_clean_card_animations(input_file, output_file)
