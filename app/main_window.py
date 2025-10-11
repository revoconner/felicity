import customtkinter as ctk
from tkinter import filedialog, Menu
from PIL import Image, ImageTk
import threading
from typing import Optional, List, Dict
import io
import base64


class PhotoGrid(ctk.CTkScrollableFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.photos = []
        self.photo_widgets = []
        self.selected_photos = set()
        self.grid_size = 180
        self.columns = 5
        self.callback = None
        self.context_callback = None
        
    def set_grid_size(self, size):
        self.grid_size = size
        self.update_layout()
    
    def set_callback(self, callback):
        self.callback = callback
    
    def set_context_callback(self, callback):
        self.context_callback = callback
    
    def clear(self):
        for widget in self.photo_widgets:
            widget.destroy()
        self.photo_widgets.clear()
        self.photos.clear()
        self.selected_photos.clear()
    
    def add_photos(self, photos):
        self.photos.extend(photos)
        self.update_layout()
    
    def update_layout(self):
        for widget in self.photo_widgets:
            widget.destroy()
        self.photo_widgets.clear()
        
        width = self.winfo_width()
        if width > 1:
            self.columns = max(1, width // (self.grid_size + 16))
        
        for idx, photo in enumerate(self.photos):
            row = idx // self.columns
            col = idx % self.columns
            
            frame = ctk.CTkFrame(self, width=self.grid_size, height=self.grid_size, corner_radius=8)
            frame.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
            frame.grid_propagate(False)
            
            try:
                if photo['thumbnail'].startswith('data:image'):
                    img_data = base64.b64decode(photo['thumbnail'].split(',')[1])
                    img = Image.open(io.BytesIO(img_data))
                    img.thumbnail((self.grid_size, self.grid_size), Image.Resampling.LANCZOS)
                    photo_image = ctk.CTkImage(light_image=img, dark_image=img, 
                                              size=(self.grid_size, self.grid_size))
                    
                    label = ctk.CTkLabel(frame, image=photo_image, text="")
                    label.image = photo_image
                    label.pack(fill="both", expand=True)
                    
                    is_selected = photo['face_id'] in self.selected_photos
                    if is_selected:
                        frame.configure(border_width=3, border_color="#3b82f6")
                    
                    label.bind("<Button-1>", lambda e, p=photo, i=idx: self._on_click(e, p, i))
                    label.bind("<Double-Button-1>", lambda e, p=photo: self._on_double_click(e, p))
                    label.bind("<Button-3>", lambda e, p=photo, f=frame: self._on_right_click(e, p, f))
            except Exception as e:
                print(f"Error loading photo: {e}")
            
            self.photo_widgets.append(frame)
    
    def _on_click(self, event, photo, index):
        if event.state & 0x0004:
            self._toggle_selection(photo['face_id'])
        elif event.state & 0x0001:
            if len(self.selected_photos) > 0:
                last_index = max([self.photos.index(p) for p in self.photos 
                                if p['face_id'] in self.selected_photos], default=index)
                start = min(last_index, index)
                end = max(last_index, index)
                for i in range(start, end + 1):
                    self.selected_photos.add(self.photos[i]['face_id'])
            self.update_layout()
        else:
            if len(self.selected_photos) == 0 and self.callback:
                self.callback(index)
            else:
                self.selected_photos.clear()
                self.update_layout()
    
    def _toggle_selection(self, face_id):
        if face_id in self.selected_photos:
            self.selected_photos.remove(face_id)
        else:
            self.selected_photos.add(face_id)
        self.update_layout()
    
    def _on_double_click(self, event, photo):
        self.master.master.master.api.open_photo(photo['path'])
    
    def _on_right_click(self, event, photo, frame):
        if self.context_callback:
            self.context_callback(event, photo, frame)


class PeopleList(ctk.CTkScrollableFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.people = []
        self.selected_person = None
        self.callback = None
        self.context_callback = None
        
    def set_callback(self, callback):
        self.callback = callback
    
    def set_context_callback(self, callback):
        self.context_callback = callback
    
    def clear(self):
        for widget in self.winfo_children():
            widget.destroy()
    
    def load_people(self, people):
        self.clear()
        self.people = people
        
        for person in people:
            frame = ctk.CTkFrame(self, corner_radius=10)
            frame.pack(fill="x", padx=12, pady=4)
            
            if person.get('thumbnail'):
                try:
                    img_data = base64.b64decode(person['thumbnail'].split(',')[1])
                    img = Image.open(io.BytesIO(img_data))
                    img.thumbnail((44, 44), Image.Resampling.LANCZOS)
                    photo_image = ctk.CTkImage(light_image=img, dark_image=img, size=(44, 44))
                    
                    avatar = ctk.CTkLabel(frame, image=photo_image, text="")
                    avatar.image = photo_image
                    avatar.pack(side="left", padx=12, pady=12)
                except:
                    avatar = ctk.CTkLabel(frame, text=person['name'][0], 
                                        width=44, height=44, corner_radius=22,
                                        fg_color="#667eea")
                    avatar.pack(side="left", padx=12, pady=12)
            else:
                avatar = ctk.CTkLabel(frame, text=person['name'][0], 
                                    width=44, height=44, corner_radius=22,
                                    fg_color="#667eea")
                avatar.pack(side="left", padx=12, pady=12)
            
            info_frame = ctk.CTkFrame(frame, fg_color="transparent")
            info_frame.pack(side="left", fill="both", expand=True)
            
            name_label = ctk.CTkLabel(info_frame, text=person['name'], 
                                     font=ctk.CTkFont(size=14, weight="bold"),
                                     anchor="w")
            name_label.pack(fill="x", padx=12, pady=(12, 2))
            
            count_text = f"{person['count']} photos"
            if person.get('tagged_count', 0) > 0:
                count_text += f" ({person['tagged_count']}/{person['count']} tagged)"
            
            count_label = ctk.CTkLabel(info_frame, text=count_text,
                                      font=ctk.CTkFont(size=12),
                                      text_color="#a0a0a0",
                                      anchor="w")
            count_label.pack(fill="x", padx=12, pady=(0, 12))
            
            frame.bind("<Button-1>", lambda e, p=person: self._on_click(p))
            name_label.bind("<Button-1>", lambda e, p=person: self._on_click(p))
            count_label.bind("<Button-1>", lambda e, p=person: self._on_click(p))
            frame.bind("<Button-3>", lambda e, p=person, f=frame: self._on_right_click(e, p, f))
    
    def _on_click(self, person):
        self.selected_person = person
        if self.callback:
            self.callback(person)
    
    def _on_right_click(self, event, person, frame):
        if self.context_callback:
            self.context_callback(event, person, frame)


class MainWindow(ctk.CTk):
    def __init__(self, api):
        super().__init__()
        
        self.api = api
        self.api.set_window(self)
        
        self.title("Face Recognition Photo Organizer")
        self.geometry("1200x800")
        
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        self.create_sidebar()
        self.create_main_area()
        self.create_bottom_bar()
        
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        threading.Thread(target=self.initialize_app, daemon=True).start()
    
    def create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, rowspan=2, sticky="nsew")
        self.sidebar.grid_propagate(False)
        
        header_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        header_frame.pack(fill="x", padx=20, pady=(24, 16))
        
        title = ctk.CTkLabel(header_frame, text="People", 
                           font=ctk.CTkFont(size=22, weight="bold"))
        title.pack(side="left")
        
        controls_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        controls_frame.pack(side="right")
        
        self.filter_btn = ctk.CTkButton(controls_frame, text="≡", width=30, 
                                       command=self.show_filter_menu)
        self.filter_btn.pack(side="left", padx=(0, 12))
        
        self.jump_btn = ctk.CTkButton(controls_frame, text="⊞", width=30,
                                     command=self.toggle_alphabet_mode)
        self.jump_btn.pack(side="left")
        
        self.people_list = PeopleList(self.sidebar, fg_color="transparent")
        self.people_list.pack(fill="both", expand=True, padx=0, pady=0)
        self.people_list.set_callback(self.on_person_selected)
        self.people_list.set_context_callback(self.show_person_context_menu)
    
    def create_main_area(self):
        self.main_area = ctk.CTkFrame(self, corner_radius=0)
        self.main_area.grid(row=0, column=1, sticky="nsew")
        self.main_area.grid_rowconfigure(1, weight=1)
        self.main_area.grid_columnconfigure(0, weight=1)
        
        header = ctk.CTkFrame(self.main_area, height=70, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew")
        header.grid_columnconfigure(0, weight=1)
        
        self.title_label = ctk.CTkLabel(header, text="Select a person",
                                       font=ctk.CTkFont(size=24, weight="bold"))
        self.title_label.pack(side="left", padx=28, pady=24)
        
        controls = ctk.CTkFrame(header, fg_color="transparent")
        controls.pack(side="right", padx=28, pady=24)
        
        ctk.CTkLabel(controls, text="Size:").pack(side="left", padx=(0, 12))
        
        self.size_slider = ctk.CTkSlider(controls, from_=100, to=300, width=160,
                                        command=self.on_size_changed)
        self.size_slider.set(180)
        self.size_slider.pack(side="left", padx=(0, 24))
        
        self.view_mode = ctk.CTkOptionMenu(controls, 
                                          values=["Show entire photo", "Zoom to tagged faces"],
                                          command=self.on_view_mode_changed)
        self.view_mode.pack(side="left")
        
        self.photo_grid = PhotoGrid(self.main_area, fg_color="transparent")
        self.photo_grid.grid(row=1, column=0, sticky="nsew", padx=28, pady=24)
        self.photo_grid.set_callback(self.on_photo_clicked)
        self.photo_grid.set_context_callback(self.show_photo_context_menu)
    
    def create_bottom_bar(self):
        self.bottom_bar = ctk.CTkFrame(self, height=100, corner_radius=0)
        self.bottom_bar.grid(row=1, column=1, sticky="ew")
        
        top_section = ctk.CTkFrame(self.bottom_bar, fg_color="transparent")
        top_section.pack(fill="x", padx=28, pady=(16, 0))
        
        self.settings_btn = ctk.CTkButton(top_section, text="Settings",
                                         command=self.show_settings)
        self.settings_btn.pack(side="left")
        
        progress_frame = ctk.CTkFrame(top_section, fg_color="transparent")
        progress_frame.pack(side="left", fill="x", expand=True, padx=32)
        
        self.progress_bar = ctk.CTkProgressBar(progress_frame)
        self.progress_bar.pack(fill="x", pady=(0, 8))
        self.progress_bar.set(0)
        
        self.progress_label = ctk.CTkLabel(progress_frame, text="Initializing...",
                                          font=ctk.CTkFont(size=12))
        self.progress_label.pack()
        
        status_bar = ctk.CTkFrame(self.bottom_bar, height=40, corner_radius=6)
        status_bar.pack(fill="x", padx=28, pady=(8, 16))
        
        self.status_label = ctk.CTkLabel(status_bar, text="PyTorch | GPU Available | CUDA: N/A | Found: 0 faces",
                                        font=ctk.CTkFont(size=11))
        self.status_label.pack(side="left", padx=12, pady=8)
        
        help_btn = ctk.CTkButton(status_bar, text="?", width=30,
                                command=self.show_help)
        help_btn.pack(side="right", padx=12, pady=8)
    
    def show_filter_menu(self):
        menu = Menu(self, tearoff=0, bg="#2a2a2a", fg="#ffffff",
                   activebackground="#3a3a3a", activeforeground="#ffffff")
        menu.add_command(label="By Names (A to Z)", command=lambda: self.set_sort_mode('names_asc'))
        menu.add_command(label="By Names (Z to A)", command=lambda: self.set_sort_mode('names_desc'))
        menu.add_command(label="By Photos (Low to High)", command=lambda: self.set_sort_mode('photos_asc'))
        menu.add_command(label="By Photos (High to Low)", command=lambda: self.set_sort_mode('photos_desc'))
        
        x = self.winfo_x() + self.filter_btn.winfo_rootx()
        y = self.winfo_y() + self.filter_btn.winfo_rooty() + self.filter_btn.winfo_height()
        menu.post(x, y)
    
    def show_person_context_menu(self, event, person, frame):
        menu = Menu(self, tearoff=0, bg="#2a2a2a", fg="#ffffff",
                   activebackground="#3a3a3a", activeforeground="#ffffff")
        menu.add_command(label="Rename", command=lambda: self.rename_person(person))
        menu.add_command(label="Hide person" if not person.get('is_hidden') else "Unhide person",
                        command=lambda: self.toggle_hide_person(person))
        menu.post(event.x_root, event.y_root)
    
    def show_photo_context_menu(self, event, photo, frame):
        menu = Menu(self, tearoff=0, bg="#2a2a2a", fg="#ffffff",
                   activebackground="#3a3a3a", activeforeground="#ffffff")
        menu.add_command(label="Make primary photo", command=lambda: self.set_primary_photo(photo))
        menu.add_command(label="Remove/Transfer Tag", command=lambda: self.transfer_photo(photo))
        menu.add_command(label="Hide photo" if not photo.get('is_hidden') else "Unhide photo",
                        command=lambda: self.toggle_hide_photo(photo))
        menu.post(event.x_root, event.y_root)
    
    def toggle_alphabet_mode(self):
        pass
    
    def set_sort_mode(self, mode):
        self.api.set_sort_mode(mode)
        self.load_people()
    
    def on_person_selected(self, person):
        self.title_label.configure(text=f"{person['name']}'s Photos")
        self.photo_grid.clear()
        threading.Thread(target=self._load_photos, args=(person,), daemon=True).start()
    
    def _load_photos(self, person):
        result = self.api.get_photos(person['clustering_id'], person['id'], 1, 1000)
        self.after(0, lambda: self.photo_grid.add_photos(result['photos']))
    
    def on_size_changed(self, value):
        self.photo_grid.set_grid_size(int(value))
        self.api.set_grid_size(int(value))
    
    def on_view_mode_changed(self, value):
        mode = 'entire_photo' if value == "Show entire photo" else 'zoom_to_faces'
        self.api.set_view_mode(mode)
        if self.people_list.selected_person:
            self.on_person_selected(self.people_list.selected_person)
    
    def on_photo_clicked(self, index):
        print(f"Photo clicked: {index}")
    
    def rename_person(self, person):
        from dialogs import RenameDialog
        dialog = RenameDialog(self, person, self.api)
        dialog.wait_window()
        self.load_people()
    
    def toggle_hide_person(self, person):
        if person.get('is_hidden'):
            self.api.unhide_person(person['clustering_id'], person['id'])
        else:
            self.api.hide_person(person['clustering_id'], person['id'])
        self.load_people()
    
    def set_primary_photo(self, photo):
        if self.people_list.selected_person:
            person = self.people_list.selected_person
            self.api.set_primary_photo(person['name'], photo['face_id'])
            self.load_people()
    
    def transfer_photo(self, photo):
        from dialogs import TransferDialog
        if self.people_list.selected_person:
            dialog = TransferDialog(self, photo, self.people_list.selected_person, self.api)
            dialog.wait_window()
            self.on_person_selected(self.people_list.selected_person)
    
    def toggle_hide_photo(self, photo):
        if photo.get('is_hidden'):
            self.api.unhide_photo(photo['face_id'])
        else:
            self.api.hide_photo(photo['face_id'])
        if self.people_list.selected_person:
            self.on_person_selected(self.people_list.selected_person)
    
    def show_settings(self):
        from dialogs import SettingsDialog
        dialog = SettingsDialog(self, self.api)
        dialog.wait_window()
        self.load_people()
    
    def show_help(self):
        from dialogs import HelpDialog
        dialog = HelpDialog(self)
        dialog.wait_window()
    
    def initialize_app(self):
        info = self.api.get_system_info()
        status_text = f"PyTorch {info['pytorch_version']} | "
        status_text += f"{'GPU Available' if info['gpu_available'] else 'CPU Only'} | "
        status_text += f"CUDA: {info['cuda_version']} | "
        status_text += f"Found: {info['total_faces']} faces"
        self.after(0, lambda: self.status_label.configure(text=status_text))
        
        self.api.check_initial_state()
    
    def load_people(self):
        people = self.api.get_people()
        self.after(0, lambda: self.people_list.load_people(people))
    
    def update_progress(self, current, total, percent):
        self.after(0, lambda: self.progress_bar.set(percent / 100))
        self.after(0, lambda: self.progress_label.configure(text=f"Scanning: {current}/{total}"))
    
    def update_status(self, message):
        self.after(0, lambda: self.progress_label.configure(text=message))
    
    def hide_progress(self):
        self.after(0, lambda: self.progress_bar.set(0))
        self.after(0, lambda: self.progress_label.configure(text="Ready"))
    
    def on_closing(self):
        self.api.close_window()
