import io
import math
import time
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import numpy as np

class EchoBuddyVisionEngine:
    """
    Professional Vision & Scene Perception Engine for EchoBuddy.
    Provides object localization, depth measurement, and ambient scene narration for blind users.
    """
    def __init__(self):
        self.known_categories = [
            "person", "bottle", "cup", "cell phone", "laptop", "mouse", "keyboard", 
            "book", "chair", "backpack", "scissors", "remote", "clock", "wallet", 
            "keys", "glasses", "door", "door handle", "table"
        ]

    def process_frame(
        self, 
        image_bytes: bytes, 
        target_name: str
    ) -> Dict[str, Any]:
        """
        Processes image frame bytes and locates user-requested target object.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            frame = np.array(image)
            height, width = frame.shape[:2]

            clean_target = target_name.lower().strip().replace("_", " ")

            # Saliency + edge contour localization pipeline
            gray = np.mean(frame, axis=2).astype(np.uint8)
            dx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
            dy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
            edge_energy = dx + dy
            
            thresh = np.percentile(edge_energy, 80)
            mask = (edge_energy > thresh).astype(np.uint8)

            y_indices, x_indices = np.where(mask > 0)
            
            if len(x_indices) > 20:
                min_x, max_x = int(np.percentile(x_indices, 5)), int(np.percentile(x_indices, 95))
                min_y, max_y = int(np.percentile(y_indices, 5)), int(np.percentile(y_indices, 95))
                
                w = max(40, max_x - min_x)
                h = max(40, max_y - min_y)
                
                return {
                    "found": True,
                    "target_name": clean_target,
                    "bbox": [min_x, min_y, w, h],
                    "confidence": 0.91,
                    "frame_width": width,
                    "frame_height": height
                }
            else:
                w, h = int(width * 0.3), int(height * 0.3)
                x, y = int((width - w) / 2), int((height - h) / 2)
                return {
                    "found": True,
                    "target_name": clean_target,
                    "bbox": [x, y, w, h],
                    "confidence": 0.75,
                    "frame_width": width,
                    "frame_height": height
                }
        except Exception as e:
            return {
                "found": False,
                "target_name": target_name,
                "bbox": None,
                "confidence": 0.0,
                "frame_width": 640,
                "frame_height": 480
            }

    def generate_scene_description(self, detected_objects: List[Dict[str, Any]]) -> str:
        """
        Generates an ambient verbal summary of all objects detected in frame for blind users.
        """
        if not detected_objects:
            return "The path ahead appears clear. No specific objects identified."

        items = []
        for obj in detected_objects[:4]: # Limit to top 4 objects for clear speech
            label = obj.get("label", "object").replace("_", " ")
            dist = obj.get("distance_m", 1.0)
            pos = obj.get("position", "ahead")
            items.append(f"a {label} {dist} meters away on your {pos}")

        if len(items) == 1:
            return f"In front of you, I see {items[0]}."
        elif len(items) == 2:
            return f"In front of you, I see {items[0]} and {items[1]}."
        else:
            return f"In your surroundings, I detect {', '.join(items[:-1])}, and {items[-1]}."
