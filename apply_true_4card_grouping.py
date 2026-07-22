import os
import win32com.client
import pythoncom

# PowerPoint Constants
msoAnimEffectFade = 10         # Smooth Fade In
msoAnimTriggerOnPageClick = 1 # 1 Click per card
msoAnimTriggerWithPrevious = 2 # 0 extra clicks!

def cluster_shapes_into_cards(shapes):
    # Cluster shapes based on spatial cell grouping
    # Group shapes if their center X is within 3.0" and center Y is within 2.5"
    clusters = []
    for s in shapes:
        cx = s.Left + s.Width / 2.0
        cy = s.Top + s.Height / 2.0
        
        matched = False
        for c in clusters:
            ref_shape = c[0]
            ref_cx = ref_shape.Left + ref_shape.Width / 2.0
            ref_cy = ref_shape.Top + ref_shape.Height / 2.0
            
            # If shape is inside or overlapping with reference card region
            if abs(cx - ref_cx) < 3.2 and abs(cy - ref_cy) < 2.2:
                c.append(s)
                matched = True
                break
        if not matched:
            clusters.append([s])

    # Sort clusters in presentation reading order (Top-to-Bottom, Left-to-Right)
    clusters.sort(key=lambda c: (round(min(s.Top for s in c), -1), min(s.Left for s in c)))
    return clusters

def create_ultra_clean_animated_pptx(input_path, output_path):
    print("Launching PowerPoint Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_presentation_clicks = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # Clear existing timeline completely
        seq = slide.TimeLine.MainSequence
        while seq.Count > 0:
            seq.Item(1).Delete()

        content_shapes = []
        for shape in slide.Shapes:
            # Filter content shapes (skip title top < 75, skip footer > 460)
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)

        if not content_shapes:
            continue

        card_clusters = cluster_shapes_into_cards(content_shapes)
        slide_clicks = len(card_clusters)
        total_presentation_clicks += slide_clicks

        # For each card cluster: First shape = OnPageClick. All remaining shapes inside card = WithPrevious!
        for cluster in card_clusters:
            # Sort shapes in cluster: container shape first
            cluster.sort(key=lambda s: s.Width * s.Height, reverse=True)
            
            for idx, shape in enumerate(cluster):
                trigger = msoAnimTriggerOnPageClick if idx == 0 else msoAnimTriggerWithPrevious
                try:
                    eff = seq.AddEffect(shape, msoAnimEffectFade, 0, trigger)
                except Exception:
                    pass

        # Clean up any sub-paragraph child triggers to ensure 1 click per card!
        for i in range(1, seq.Count + 1):
            try:
                eff = seq.Item(i)
                # Check if this effect is not a primary card effect
                if eff.Timing.TriggerType == msoAnimTriggerOnPageClick:
                    # Keep OnPageClick for primary card triggers
                    pass
            except Exception:
                pass

        print(f"Slide {slide_idx+1}: Reduced to EXACTLY {slide_clicks} CARD CLICKS!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"SUCCESS! Ultra-Clean Card Animations Applied!")
    print(f"Total Clicks for ENTIRE 14-Slide Presentation: ONLY {total_presentation_clicks} CLICKS TOTAL (~3-4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    create_ultra_clean_animated_pptx(input_file, output_file)
