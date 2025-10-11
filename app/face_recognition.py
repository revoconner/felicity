import argparse
import torch

from utils import get_appdata_path
from settings import Settings
from api import API
from main_window import MainWindow

GPU_AVAILABLE = torch.cuda.is_available()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--minimized', action='store_true', help='Start minimized to tray')
    args = parser.parse_args()
    
    print("=" * 60)
    print("Face Recognition Photo Organizer")
    print("=" * 60)
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {GPU_AVAILABLE}")
    if GPU_AVAILABLE:
        print(f"CUDA version: {torch.version.cuda}")
        print(f"GPU device: {torch.cuda.get_device_name(0)}")
    print("=" * 60)
    
    settings_path = get_appdata_path()
    settings = Settings(str(settings_path))
    
    print(f"Settings loaded from: {settings.settings_file}")
    print(f"Threshold: {settings.get('threshold')}%")
    print(f"Include folders: {settings.get('include_folders')}")
    print(f"Exclude folders: {settings.get('exclude_folders')}")
    print(f"Wildcard exclusions: {settings.get('wildcard_exclusions')}")
    print("=" * 60)
    
    api = API(settings)
    
    app = MainWindow(api)
    
    if args.minimized:
        app.withdraw()
    
    app.mainloop()
    
    api.close()


if __name__ == "__main__":
    main()
