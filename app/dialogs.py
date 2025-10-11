import customtkinter as ctk
from tkinter import filedialog


class RenameDialog(ctk.CTkToplevel):
    def __init__(self, parent, person, api):
        super().__init__(parent)
        
        self.person = person
        self.api = api
        
        self.title("Rename Person")
        self.geometry("400x150")
        self.resizable(False, False)
        
        self.transient(parent)
        self.grab_set()
        
        label = ctk.CTkLabel(self, text=f"Rename '{person['name']}':",
                           font=ctk.CTkFont(size=16, weight="bold"))
        label.pack(pady=(20, 10))
        
        self.entry = ctk.CTkEntry(self, width=350)
        self.entry.pack(pady=10)
        self.entry.insert(0, person['name'].replace(" (hidden)", ""))
        self.entry.focus()
        self.entry.bind("<Return>", lambda e: self.on_confirm())
        
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(pady=10)
        
        confirm_btn = ctk.CTkButton(button_frame, text="Confirm", command=self.on_confirm)
        confirm_btn.pack(side="left", padx=5)
        
        cancel_btn = ctk.CTkButton(button_frame, text="Cancel", command=self.destroy)
        cancel_btn.pack(side="left", padx=5)
    
    def on_confirm(self):
        new_name = self.entry.get().strip()
        if new_name:
            result = self.api.rename_person(self.person['clustering_id'], 
                                          self.person['id'], new_name)
            if result.get('success'):
                self.destroy()
            else:
                ctk.CTkLabel(self, text=f"Error: {result.get('message', 'Unknown error')}",
                           text_color="red").pack()


class TransferDialog(ctk.CTkToplevel):
    def __init__(self, parent, photo, person, api):
        super().__init__(parent)
        
        self.photo = photo
        self.person = person
        self.api = api
        
        self.title("Transfer Face")
        self.geometry("400x600")
        self.resizable(False, False)
        
        self.transient(parent)
        self.grab_set()
        
        label = ctk.CTkLabel(self, text="Transfer Face To...",
                           font=ctk.CTkFont(size=20, weight="bold"))
        label.pack(pady=20)
        
        self.list_frame = ctk.CTkScrollableFrame(self, width=350, height=450)
        self.list_frame.pack(pady=10, padx=20, fill="both", expand=True)
        
        result = api.get_named_people_for_transfer(person['clustering_id'])
        if result.get('success'):
            remove_btn = ctk.CTkButton(self.list_frame, text="Remove from this person",
                                      fg_color="#ef4444", hover_color="#dc2626",
                                      command=self.on_remove)
            remove_btn.pack(fill="x", pady=5)
            
            for p in result['people']:
                btn = ctk.CTkButton(self.list_frame, text=f"Transfer to {p['name']}",
                                   command=lambda name=p['name']: self.on_transfer(name))
                btn.pack(fill="x", pady=5)
        
        cancel_btn = ctk.CTkButton(self, text="Cancel", command=self.destroy)
        cancel_btn.pack(pady=10)
    
    def on_remove(self):
        self.api.remove_face_to_unmatched(self.person['clustering_id'], self.photo['face_id'])
        self.destroy()
    
    def on_transfer(self, target_name):
        self.api.transfer_face_to_person(self.person['clustering_id'], 
                                        self.photo['face_id'], target_name)
        self.destroy()


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, parent, api):
        super().__init__(parent)
        
        self.api = api
        
        self.title("Settings")
        self.geometry("1200x700")
        
        self.transient(parent)
        self.grab_set()
        
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        self.create_sidebar()
        self.create_content_area()
        
        self.show_panel("general")
    
    def create_sidebar(self):
        sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_propagate(False)
        
        title = ctk.CTkLabel(sidebar, text="Settings",
                           font=ctk.CTkFont(size=24, weight="bold"))
        title.pack(pady=(24, 24), padx=20)
        
        self.nav_buttons = {}
        
        btn1 = ctk.CTkButton(sidebar, text="General Settings", anchor="w",
                            command=lambda: self.show_panel("general"))
        btn1.pack(fill="x", padx=12, pady=4)
        self.nav_buttons["general"] = btn1
        
        btn2 = ctk.CTkButton(sidebar, text="Folders to Scan", anchor="w",
                            command=lambda: self.show_panel("folders"))
        btn2.pack(fill="x", padx=12, pady=4)
        self.nav_buttons["folders"] = btn2
        
        btn3 = ctk.CTkButton(sidebar, text="View Log", anchor="w",
                            command=lambda: self.show_panel("log"))
        btn3.pack(fill="x", padx=12, pady=4)
        self.nav_buttons["log"] = btn3
        
        close_btn = ctk.CTkButton(sidebar, text="Close Settings",
                                 fg_color="#dc2626", hover_color="#b91c1c",
                                 command=self.destroy)
        close_btn.pack(side="bottom", pady=20, padx=20, fill="x")
        
        version_label = ctk.CTkLabel(sidebar, text="For personal use only - Free license\nVersion: 0.7.0.b",
                                    font=ctk.CTkFont(size=11), text_color="#606060")
        version_label.pack(side="bottom", pady=10)
    
    def create_content_area(self):
        self.content_area = ctk.CTkFrame(self, corner_radius=0)
        self.content_area.grid(row=0, column=1, sticky="nsew")
        
        self.panels = {}
        self.create_general_panel()
        self.create_folders_panel()
        self.create_log_panel()
    
    def create_general_panel(self):
        panel = ctk.CTkScrollableFrame(self.content_area)
        self.panels["general"] = panel
        
        title = ctk.CTkLabel(panel, text="General Settings",
                           font=ctk.CTkFont(size=28, weight="bold"))
        title.pack(pady=(40, 32), padx=48, anchor="w")
        
        settings_frame = ctk.CTkFrame(panel, corner_radius=12)
        settings_frame.pack(fill="x", padx=48, pady=(0, 24))
        
        self.threshold_var = ctk.IntVar(value=self.api.get_threshold())
        self.create_setting_row(settings_frame, "Threshold", 
                               self.create_threshold_control())
        
        self.dynamic_resources_var = ctk.BooleanVar(value=self.api.get_dynamic_resources())
        self.create_setting_row(settings_frame, "Use system resources dynamically",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.dynamic_resources_var,
                                           command=lambda: self.api.set_dynamic_resources(self.dynamic_resources_var.get())))
        
        self.show_unmatched_var = ctk.BooleanVar(value=self.api.get_show_unmatched())
        self.create_setting_row(settings_frame, "Show single unmatched images",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.show_unmatched_var,
                                           command=lambda: self.api.set_show_unmatched(self.show_unmatched_var.get())))
        
        self.close_to_tray_var = ctk.BooleanVar(value=self.api.get_close_to_tray())
        self.create_setting_row(settings_frame, "Close to tray",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.close_to_tray_var,
                                           command=lambda: self.api.set_close_to_tray(self.close_to_tray_var.get())))
        
        self.show_hidden_var = ctk.BooleanVar(value=self.api.get_show_hidden())
        self.create_setting_row(settings_frame, "Show hidden person",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.show_hidden_var,
                                           command=lambda: self.api.set_show_hidden(self.show_hidden_var.get())))
        
        self.show_hidden_photos_var = ctk.BooleanVar(value=self.api.get_show_hidden_photos())
        self.create_setting_row(settings_frame, "Show hidden photos",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.show_hidden_photos_var,
                                           command=lambda: self.api.set_show_hidden_photos(self.show_hidden_photos_var.get())))
        
        self.hide_unnamed_var = ctk.BooleanVar(value=self.api.get_hide_unnamed_persons())
        self.create_setting_row(settings_frame, "Hide unnamed persons",
                               ctk.CTkSwitch(settings_frame, text="", variable=self.hide_unnamed_var,
                                           command=lambda: self.api.set_hide_unnamed_persons(self.hide_unnamed_var.get())))
        
        scan_freq_frame = ctk.CTkFrame(settings_frame, fg_color="transparent")
        scan_freq_label = ctk.CTkLabel(scan_freq_frame, text="Find changes in photos in the drive")
        scan_freq_label.pack(side="left")
        
        self.scan_freq_var = ctk.StringVar(value=self.api.get_scan_frequency())
        scan_freq_menu = ctk.CTkOptionMenu(scan_freq_frame, variable=self.scan_freq_var,
                                          values=["every_restart", "restart_1_day", "restart_1_week", "manual"],
                                          command=lambda v: self.api.set_scan_frequency(v))
        scan_freq_menu.pack(side="right")
        self.create_setting_row(settings_frame, "", scan_freq_frame, use_label=False)
    
    def create_threshold_control(self):
        frame = ctk.CTkFrame(self.panels["general"], fg_color="transparent")
        
        slider = ctk.CTkSlider(frame, from_=10, to=90, variable=self.threshold_var,
                              command=lambda v: self.threshold_label.configure(text=f"{int(v)}%"))
        slider.pack(side="left", fill="x", expand=True)
        
        self.threshold_label = ctk.CTkLabel(frame, text=f"{self.threshold_var.get()}%", width=45)
        self.threshold_label.pack(side="left", padx=16)
        
        recal_btn = ctk.CTkButton(frame, text="Recalibrate",
                                 command=lambda: self.api.recalibrate(self.threshold_var.get()))
        recal_btn.pack(side="left")
        
        return frame
    
    def create_folders_panel(self):
        panel = ctk.CTkScrollableFrame(self.content_area)
        self.panels["folders"] = panel
        
        title = ctk.CTkLabel(panel, text="Folders to Scan",
                           font=ctk.CTkFont(size=28, weight="bold"))
        title.pack(pady=(40, 32), padx=48, anchor="w")
        
        include_label = ctk.CTkLabel(panel, text="Include folders for scanning",
                                    font=ctk.CTkFont(size=14, weight="bold"))
        include_label.pack(pady=(0, 12), padx=48, anchor="w")
        
        self.include_list = ctk.CTkTextbox(panel, height=200, width=1000)
        self.include_list.pack(pady=(0, 12), padx=48, fill="x")
        
        include_folders = self.api.get_include_folders()
        for folder in include_folders:
            self.include_list.insert("end", folder + "\n")
        
        include_btn_frame = ctk.CTkFrame(panel, fg_color="transparent")
        include_btn_frame.pack(pady=(0, 24), padx=48, anchor="w")
        
        ctk.CTkButton(include_btn_frame, text="+ Add Folder",
                     command=self.add_include_folder).pack(side="left", padx=(0, 12))
        ctk.CTkButton(include_btn_frame, text="- Remove Folder", fg_color="#ef4444",
                     command=self.remove_include_folder).pack(side="left")
        
        exclude_label = ctk.CTkLabel(panel, text="Exclude subfolders from scanning",
                                    font=ctk.CTkFont(size=14, weight="bold"))
        exclude_label.pack(pady=(0, 12), padx=48, anchor="w")
        
        self.exclude_list = ctk.CTkTextbox(panel, height=200, width=1000)
        self.exclude_list.pack(pady=(0, 12), padx=48, fill="x")
        
        exclude_folders = self.api.get_exclude_folders()
        for folder in exclude_folders:
            self.exclude_list.insert("end", folder + "\n")
        
        exclude_btn_frame = ctk.CTkFrame(panel, fg_color="transparent")
        exclude_btn_frame.pack(pady=(0, 24), padx=48, anchor="w")
        
        ctk.CTkButton(exclude_btn_frame, text="+ Add Folder",
                     command=self.add_exclude_folder).pack(side="left", padx=(0, 12))
        ctk.CTkButton(exclude_btn_frame, text="- Remove Folder", fg_color="#ef4444",
                     command=self.remove_exclude_folder).pack(side="left")
        
        wildcard_label = ctk.CTkLabel(panel, text="Wildcard Exclusion",
                                     font=ctk.CTkFont(size=14, weight="bold"))
        wildcard_label.pack(pady=(0, 12), padx=48, anchor="w")
        
        self.wildcard_entry = ctk.CTkEntry(panel, width=1000, 
                                          placeholder_text="e.g., *.gif, *thumbnail, *cache*")
        self.wildcard_entry.pack(pady=(0, 24), padx=48, fill="x")
        self.wildcard_entry.insert(0, self.api.get_wildcard_exclusions())
        self.wildcard_entry.bind("<FocusOut>", 
                                lambda e: self.api.set_wildcard_exclusions(self.wildcard_entry.get()))
        
        rescan_btn = ctk.CTkButton(panel, text="Rescan For Changes", width=1000,
                                  command=lambda: self.api.start_scanning())
        rescan_btn.pack(pady=(0, 24), padx=48, fill="x")
    
    def create_log_panel(self):
        panel = ctk.CTkFrame(self.content_area)
        self.panels["log"] = panel
        
        header = ctk.CTkFrame(panel, fg_color="transparent")
        header.pack(fill="x", pady=(40, 20), padx=48)
        
        title = ctk.CTkLabel(header, text="View Log",
                           font=ctk.CTkFont(size=28, weight="bold"))
        title.pack(side="left")
        
        save_btn = ctk.CTkButton(header, text="Save Log", command=self.save_log)
        save_btn.pack(side="right")
        
        self.log_text = ctk.CTkTextbox(panel, font=ctk.CTkFont(family="Courier", size=12))
        self.log_text.pack(fill="both", expand=True, padx=48, pady=(0, 40))
    
    def create_setting_row(self, parent, label_text, control, use_label=True):
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", padx=24, pady=16)
        
        if use_label:
            label = ctk.CTkLabel(row, text=label_text, anchor="w")
            label.pack(side="left")
        
        if isinstance(control, ctk.CTkFrame):
            control.pack(side="right", fill="x", expand=True)
        else:
            control.pack(side="right")
    
    def show_panel(self, panel_name):
        for name, panel in self.panels.items():
            if name == panel_name:
                panel.pack(fill="both", expand=True)
                if name in self.nav_buttons:
                    self.nav_buttons[name].configure(fg_color=("#3b8ed0", "#1f6aa5"))
            else:
                panel.pack_forget()
                if name in self.nav_buttons:
                    self.nav_buttons[name].configure(fg_color=("gray75", "gray25"))
    
    def add_include_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            folders = self.api.get_include_folders()
            if folder not in folders:
                folders.append(folder)
                self.api.set_include_folders(folders)
                self.include_list.insert("end", folder + "\n")
    
    def remove_include_folder(self):
        content = self.include_list.get("1.0", "end").strip()
        folders = [f for f in content.split("\n") if f]
        if folders:
            folders.pop()
            self.api.set_include_folders(folders)
            self.include_list.delete("1.0", "end")
            for folder in folders:
                self.include_list.insert("end", folder + "\n")
    
    def add_exclude_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            folders = self.api.get_exclude_folders()
            if folder not in folders:
                folders.append(folder)
                self.api.set_exclude_folders(folders)
                self.exclude_list.insert("end", folder + "\n")
    
    def remove_exclude_folder(self):
        content = self.exclude_list.get("1.0", "end").strip()
        folders = [f for f in content.split("\n") if f]
        if folders:
            folders.pop()
            self.api.set_exclude_folders(folders)
            self.exclude_list.delete("1.0", "end")
            for folder in folders:
                self.exclude_list.insert("end", folder + "\n")
    
    def save_log(self):
        file_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        if file_path:
            with open(file_path, 'w') as f:
                f.write(self.log_text.get("1.0", "end"))
    
    def add_log_entry(self, message):
        self.log_text.insert("end", message + "\n")
        self.log_text.see("end")


class HelpDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        
        self.title("Quick Help")
        self.geometry("900x600")
        
        self.transient(parent)
        self.grab_set()
        
        title = ctk.CTkLabel(self, text="Quick Help",
                           font=ctk.CTkFont(size=28, weight="bold"))
        title.pack(pady=(40, 32), padx=48)
        
        help_frame = ctk.CTkScrollableFrame(self)
        help_frame.pack(fill="both", expand=True, padx=48, pady=(0, 20))
        
        help_items = [
            "Single click the image to bring up a preview inside the app",
            "Double click the image to open it in your default image viewer app",
            "By default the person's detected are named person 1, person 2 and so on. Use rename option in the person's menu to rename them",
            "Once renamed their default preview photo can be changed",
            "If you want to see the person that is tagged in the image (say in a group photo) use the drop down above",
            "You can hide a person from the list, to unhide, show all hidden person in general settings",
            "Select multiple photos by pressing and holding CTRL or SHIFT key",
            "You can hide a photo from the grid, to unhide, show all hidden photos in general settings",
            "User remove/transfer tag in the photo thumbnail to transfer that photo to other person (someone you have named)",
            "Photo scan be CPU intensive task, to reduce cpu usage, close to tray during scan",
            "To add more folders or remove folders, as well as exclude subfolders where photos are, do so in the settings",
            "Any images that are added to disk, or removed from disk will be scanned at next restart, or on the next restart after a day, or a week, or manually. You can change the frequency in settings"
        ]
        
        for item in help_items:
            label = ctk.CTkLabel(help_frame, text=f"• {item}", 
                               font=ctk.CTkFont(size=15),
                               wraplength=800, justify="left")
            label.pack(pady=8, padx=20, anchor="w")
        
        close_btn = ctk.CTkButton(self, text="Close Quick Help",
                                 command=self.destroy, width=200)
        close_btn.pack(pady=20)
