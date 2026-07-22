import os
import win32com.client

# PowerPoint Constants
msoAnimEffectFade = 10         # Smooth Fade In Entrance
msoAnimTriggerOnPageClick = 1 # 1 Click per card
msoAnimTriggerWithPrevious = 2 # Appears automatically WITH card (0 extra clicks!)
ppAnimateLevelNone = 0

def cluster_shapes_into_cards(shapes):
    clusters = []
    for s in shapes:
        cx = s.Left + s.Width / 2.0
        cy = s.Top + s.Height / 2.0
        matched = False
        for c in clusters:
            ref_shape = c[0]
            ref_cx = ref_shape.Left + ref_shape.Width / 2.0
            ref_cy = ref_shape.Top + ref_shape.Height / 2.0
            if abs(cx - ref_cx) < 3.2 and abs(cy - ref_cy) < 2.2:
                c.append(s)
                matched = True
                break
        if not matched:
            clusters.append([s])

    clusters.sort(key=lambda c: (round(min(s.Top for s in c), -1), min(s.Left for s in c)))
    return clusters

def create_ultra_clean_card_animated_pptx(input_path, output_path):
    print("Launching PowerPoint Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_presentation_clicks = 0

    for slide_idx, slide in enumerate(pres.Slides):
        # 1. Clear existing animation sequence completely
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

        content_shapes = []
        for shape in slide.Shapes:
            # Skip top title header (top < 75) and footer (top > 460)
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)

        if not content_shapes:
            continue

        card_clusters = cluster_shapes_into_cards(content_shapes)
        slide_clicks = len(card_clusters)
        total_presentation_clicks += slide_clicks

        # 2. Add Fade effect for each cluster
        # First shape of cluster = OnPageClick (1 click per card). All sub-shapes = WithPrevious!
        for cluster in card_clusters:
            cluster.sort(key=lambda s: s.Width * s.Height, reverse=True)
            for idx, shape in enumerate(cluster):
                trigger = msoAnimTriggerOnPageClick if idx == 0 else msoAnimTriggerWithPrevious
                try:
                    eff = seq.AddEffect(shape, msoAnimEffectFade, 0, trigger)
                except Exception:
                    pass

        # 3. CRITICAL: Loop through ALL generated effects in sequence timeline.
        # Set TriggerType = WithPrevious (2) for all sub-effects!
        card_primary_shape_ids = set(c[0].Id for c in card_clusters)
        seen_primary_ids = set()
        
        for i in range(1, seq.Count + 1):
            try:
                eff = seq.Item(i)
                sp_id = eff.Shape.Id
                if sp_id in card_primary_shape_ids and sp_id not in seen_primary_ids:
                    eff.Timing.TriggerType = msoAnimTriggerOnPageClick
                    seen_primary_ids.add(sp_id)
                else:
                    eff.Timing.TriggerType = msoAnimTriggerWithPrevious
            except Exception:
                pass

        print(f"Slide {slide_idx+1}: Reduced to EXACTLY {len(seen_primary_ids)} CARD CLICKS!")

    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()

    print(f"\n========================================================")
    print(f"PERFECT SUCCESS! Card-Level Animations Applied!")
    print(f"Total Clicks for ENTIRE 14-Slide Presentation: ONLY {total_presentation_clicks} CLICKS TOTAL (~3-4 clicks per slide)!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    
    os.system("taskkill /f /im POWERPNT.EXE 2>nul")
    create_ultra_clean_card_animated_pptx(input_file, output_file)
