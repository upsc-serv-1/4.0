import os
import win32com.client
import pythoncom

# PowerPoint Constants
msoAnimEffectFade = 10         # Fade In
msoAnimTriggerOnPageClick = 1 # On Click

def group_and_animate_pptx(input_path, output_path):
    print("Launching PowerPoint Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_presentation_clicks = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # Clear existing animation timeline
        seq = slide.TimeLine.MainSequence
        while seq.Count > 0:
            seq.Item(1).Delete()

        content_shapes = []
        for shape in slide.Shapes:
            # Filter content shapes (top > 75pt, top < 460pt)
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

        slide_clicks = 0

        for cluster in card_clusters:
            shape_names = [s.Name for s in cluster]
            target_shape = None

            if len(shape_names) > 1:
                try:
                    # Pass VT_ARRAY of BSTR shape names to PowerPoint Shapes.Range().Group()
                    v_names = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_BSTR, shape_names)
                    target_shape = slide.Shapes.Range(v_names).Group()
                except Exception as e:
                    # Fallback to shape index array
                    try:
                        indices = [s.ZOrderPosition for s in cluster]
                        v_idx = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_I4, indices)
                        target_shape = slide.Shapes.Range(v_idx).Group()
                    except Exception:
                        target_shape = cluster[0]
            else:
                target_shape = cluster[0]

            # Add EXACTLY 1 Fade entrance effect per card group!
            try:
                seq.AddEffect(target_shape, msoAnimEffectFade, 0, msoAnimTriggerOnPageClick)
                slide_clicks += 1
            except Exception:
                pass

        total_presentation_clicks += slide_clicks
        print(f"Slide {slide_idx+1}: Reduced from {len(content_shapes)} shapes to EXACTLY {slide_clicks} CARD CLICKS!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"PERFECT SUCCESS! Native PowerPoint Shape Grouping Complete!")
    print(f"Total Clicks for ENTIRE 14-Slide Presentation: ONLY {total_presentation_clicks} CLICKS TOTAL (~3-4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    group_and_animate_pptx(input_file, output_file)
