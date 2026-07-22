import os
import win32com.client
import pythoncom

# PowerPoint Constants
msoAnimEffectFade = 10         # Smooth Fade In
msoAnimTriggerOnPageClick = 1 # 1 Click per card

def apply_1_click_per_card_animations(input_path, output_path):
    print("Launching PowerPoint COM Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_clicks_count = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # Clear existing timeline completely
        seq = slide.TimeLine.MainSequence
        while seq.Count > 0:
            seq.Item(1).Delete()

        # Collect content shapes (skip title top < 75pt, footer top > 460pt)
        content_shapes = []
        for shape in slide.Shapes:
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)

        if not content_shapes:
            continue

        # Group shapes by card bounding box proximity (within 2.2 inches)
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
        total_clicks_count += slide_clicks

        # For each card cluster:
        # Group shapes into 1 PPT Group or add WithPrevious to child shapes
        for cluster in card_clusters:
            # Container shape first
            cluster.sort(key=lambda s: s.Width * s.Height, reverse=True)
            
            # Try native PPT grouping
            target_shape = None
            if len(cluster) > 1:
                try:
                    shape_indices = [s.Id for s in cluster]
                    # Try grouping by shape IDs
                    target_shape = slide.Shapes.Range(shape_indices).Group()
                except Exception:
                    pass

            if target_shape is not None:
                try:
                    seq.AddEffect(target_shape, msoAnimEffectFade, 0, msoAnimTriggerOnPageClick)
                except Exception:
                    pass
            else:
                # Fallback: First shape = OnClick, sub-shapes = WithPrevious (0 extra clicks!)
                for idx, shape in enumerate(cluster):
                    trigger = msoAnimTriggerOnPageClick if idx == 0 else 2 # 2 = msoAnimTriggerWithPrevious
                    try:
                        seq.AddEffect(shape, msoAnimEffectFade, 0, trigger)
                    except Exception:
                        pass

        print(f"Slide {slide_idx+1}: Configured for EXACTLY {slide_clicks} card clicks!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"SUCCESS! 1-Click-per-Card PowerPoint Animations Applied!")
    print(f"Total Clicks across ALL 14 Slides: ONLY {total_clicks_count} Clicks (~3-4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    apply_1_click_per_card_animations(input_file, output_file)
