import os
import win32com.client

def add_native_pptx_animations(input_path, output_path):
    print("Launching PowerPoint COM Application...")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    ppt_app.Visible = True

    pres = ppt_app.Presentations.Open(input_path, False, False, True)
    print(f"Opened presentation with {pres.Slides.Count} slides.")

    total_effects_added = 0

    for slide_num, slide in enumerate(pres.Slides):
        content_shapes = []
        for shape in slide.Shapes:
            # Filter content shapes (below top title 75pt, above footer 460pt)
            if shape.Top > 75 and shape.Top < 460:
                content_shapes.append(shape)
                
        # Sort content shapes by Top and Left coordinates
        content_shapes.sort(key=lambda s: (round(s.Top, -1), s.Left))

        for shape in content_shapes:
            try:
                # Signature: AddEffect(Shape, EffectId, Level, Trigger)
                # EffectId 10 = Fade, Level 0 = msoAnimateLevelNone, Trigger 1 = OnClick
                slide.TimeLine.MainSequence.AddEffect(shape, 10, 0, 1)
                total_effects_added += 1
            except Exception as e:
                print(f"Slide {slide_num+1} shape {shape.Name} error: {e}")

    # Save output
    pres.SaveAs(output_path)
    pres.Close()
    ppt_app.Quit()
    print(f"SUCCESS: Applied {total_effects_added} native PowerPoint Fade animations across all 14 slides!")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Dr. Yogesh\Downloads\Sociology_Optional_Orientation_Updated.pptx"
    output_file = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\Sociology_Optional_Orientation_Animated.pptx"
    add_native_pptx_animations(input_file, output_file)
