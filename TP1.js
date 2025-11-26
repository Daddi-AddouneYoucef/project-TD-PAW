const AttendanceApp = {
    config: {
        colors: {
            good:   { class: 'status-good',    bg: '#dcfce7', gradient: 'linear-gradient(135deg, #10b981, #059669)' }, 
            warn:   { class: 'status-warning', bg: '#fef3c7', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' }, 
            danger: { class: 'status-danger',  bg: '#fee2e2', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' } 
        },
        thresholds: { warn: 1, danger: 3 },
        apiEndpoint: 'attendance.php',
        saveEndpoint: 'save_student.php',
        dataEndpoint: 'students.json'
    },

    state: {
        pendingRequests: new Map() 
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.injectToolbar(); 
        this.loadStudents();
    },

    cacheDOM() {
        this.dom = {
            table: document.querySelector('.modern-table'),
            tbody: document.getElementById('student-table-body'),
            rows: document.querySelectorAll('tbody tr'),
            toast: document.getElementById('toast'),
            toastMsg: document.getElementById('toast-msg'),
            header: document.querySelector('.header'),
            addForm: document.getElementById('addStudentForm')
        };
    },

    bindEvents() {
        if (this.dom.tbody) {
            this.dom.tbody.addEventListener('change', (e) => {
                if (e.target.matches('input[type="checkbox"]')) {
                    this.handleCheckboxChange(e.target);
                }
            });
        }

        if (this.dom.addForm) {
            this.dom.addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNewStudentSubmit();
            });
        }
    },

    loadStudents() {
        fetch(this.config.dataEndpoint + '?t=' + new Date().getTime())
            .then(res => res.json())
            .then(students => {
                this.dom.tbody.innerHTML = '';
                students.forEach(student => {
                    this.renderRow(student);
                });
                this.refreshAllStats();
            })
            .catch(err => console.error(err));
    },

    handleNewStudentSubmit() {
        const sid = document.getElementById('sid').value;
        const fname = document.getElementById('fname').value;
        const lname = document.getElementById('lname').value;

        const newStudent = { id: sid, fname: fname, lname: lname };

        fetch(this.config.saveEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStudent)
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                this.renderRow(newStudent);
                this.dom.addForm.reset();
                this.showToast("Student Added & Saved!");
                this.refreshAllStats();
            } else {
                this.showToast("Error saving file", true);
            }
        })
        .catch(err => {
            console.error(err);
            this.showToast("Server Error", true);
        });
    },

    renderRow(student) {
        const tr = document.createElement('tr');
        tr.dataset.id = student.id;
        
        // Ensure attendance object exists
        const att = student.attendance || {};

        let weeksHTML = '';
        for(let i=1; i<=6; i++) {
            // Check the keys w1_present, w1_participated, etc.
            const isPres = att[`w${i}_present`] ? 'checked' : '';
            const isPart = att[`w${i}_participated`] ? 'checked' : '';

            weeksHTML += `
                <td class="text-center">
                    <input type="checkbox" data-sid="${student.id}" data-week="${i}" data-type="present" ${isPres}>
                </td>
                <td class="text-center">
                    <input type="checkbox" data-sid="${student.id}" data-week="${i}" data-type="participated" ${isPart}>
                </td>
            `;
        }

        tr.innerHTML = `
            <td class="col-sticky">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:35px; height:35px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:0.9rem;">
                        ${student.fname.charAt(0)}${student.lname.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight:600; color:#0f172a;">${student.lname}, ${student.fname}</div>
                        <div style="font-size:0.8rem; color:#64748b;">ID: ${student.id}</div>
                    </div>
                </div>
            </td>
            ${weeksHTML}
            <td class="text-center">
                <div style="font-weight:700; color:#ef4444;" class="absences">0</div>
                <div style="font-size:0.75rem; color:#64748b;">Absences</div>
            </td>
        `;

        this.dom.tbody.appendChild(tr);
    },

    injectToolbar() {
        if (!this.dom.header) return;

        const toolbar = document.createElement('div');
        toolbar.style.cssText = "display:flex; gap:10px; margin-top:15px; flex-wrap:wrap;";
        
        const searchInput = document.createElement('input');
        searchInput.placeholder = "🔍 Search student...";
        searchInput.style.cssText = "padding:10px 15px; border-radius:8px; border:1px solid #cbd5e1; flex-grow:1; font-family:inherit;";
        searchInput.addEventListener('input', (e) => this.filterStudents(e.target.value));

        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = "⬇ Export CSV";
        exportBtn.style.cssText = "padding:10px 20px; border-radius:8px; border:none; background:#1e293b; color:white; cursor:pointer; font-weight:600;";
        exportBtn.addEventListener('click', () => this.exportToCSV());

        const summary = document.createElement('div');
        summary.id = 'stats-summary';
        summary.style.cssText = "width:100%; display:flex; gap:20px; font-size:0.9rem; color:#64748b; margin-top:10px;";

        toolbar.appendChild(searchInput);
        toolbar.appendChild(exportBtn);
        toolbar.appendChild(summary);
        
        this.dom.header.insertAdjacentElement('afterend', toolbar);
        this.dom.toolbar = { searchInput, exportBtn, summary };
    },

    calculateRowStats(row) {
        const checkboxes = row.querySelectorAll('input[type="checkbox"]');
        let abs = 0, part = 0;

        checkboxes.forEach(box => {
            const type = box.dataset.type;
            if (type === 'present' && !box.checked) abs++;
            if (type === 'participated' && box.checked) part++;
        });

        return { abs, part };
    },

    refreshAllStats() {
        let totalStudents = 0;
        let totalAtRisk = 0;
        
        const currentRows = document.querySelectorAll('tbody tr'); 

        currentRows.forEach(row => {
            const stats = this.calculateRowStats(row);
            this.updateRowVisuals(row, stats);
            
            totalStudents++;
            if(stats.abs >= this.config.thresholds.danger) totalAtRisk++;
        });

        this.updateGlobalDashboard(totalStudents, totalAtRisk);
    },

    updateRowVisuals(row, stats) {
        const absEl = row.querySelector('.absences');
        if(absEl) absEl.textContent = stats.abs;

        const avatar = row.querySelector('.avatar');
        const stickyCol = row.querySelector('.col-sticky');

        row.classList.remove(
            this.config.colors.good.class, 
            this.config.colors.warn.class, 
            this.config.colors.danger.class
        );

        let statusConfig;

        if (stats.abs >= this.config.thresholds.danger) {
            statusConfig = this.config.colors.danger;
        } else if (stats.abs >= this.config.thresholds.warn) {
            statusConfig = this.config.colors.warn;
        } else {
            statusConfig = this.config.colors.good;
        }

        row.classList.add(statusConfig.class);
        if (avatar) avatar.style.background = statusConfig.gradient;
        if (stickyCol) stickyCol.style.background = statusConfig.bg; 
    },

    updateGlobalDashboard(total, atRisk) {
        if(!this.dom.toolbar) return;
        const healthy = total - atRisk;
        this.dom.toolbar.summary.innerHTML = `
            <span>👥 Students: <b>${total}</b></span>
            <span style="color:#10b981">✅ Healthy: <b>${healthy}</b></span>
            <span style="color:#ef4444">⚠️ At Risk: <b>${atRisk}</b></span>
        `;
    },

    handleCheckboxChange(checkbox) {
        const row = checkbox.closest('tr');
        
        const stats = this.calculateRowStats(row);
        this.updateRowVisuals(row, stats);
        this.refreshAllStats(); 

        const wrapper = checkbox.parentElement; 
        wrapper.style.opacity = '0.5';
        wrapper.style.pointerEvents = 'none';

        this.saveToDB(checkbox)
            .finally(() => {
                wrapper.style.opacity = '1';
                wrapper.style.pointerEvents = 'auto';
            });
    },

    saveToDB(checkbox) {
        const payload = new FormData();
        payload.append('ajax_update', '1');
        payload.append('student_id', checkbox.dataset.sid);
        payload.append('week', checkbox.dataset.week);
        payload.append('type', checkbox.dataset.type);
        payload.append('value', checkbox.checked ? 1 : 0);

        return fetch(this.config.apiEndpoint, {
            method: 'POST',
            body: payload
        })
        .then(res => res.text())
        .then(txt => {
            this.showToast("Saved successfully");
        })
        .catch(err => {
            console.error(err);
            this.showToast("Sync failed!", true);
            checkbox.checked = !checkbox.checked; 
        });
    },

    filterStudents(query) {
        const lowerQuery = query.toLowerCase();
        document.querySelectorAll('tbody tr').forEach(row => {
            const text = row.querySelector('.col-sticky')?.innerText.toLowerCase() || "";
            if (text.includes(lowerQuery)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    exportToCSV() {
        let csv = [];
        const rows = document.querySelectorAll("table tr");
        
        rows.forEach(row => {
            let cols = [];
            if (row.querySelector('th')) {
                row.querySelectorAll('th').forEach(th => cols.push('"' + th.innerText + '"'));
            } 
            else {
                const nameCol = row.querySelector('.col-sticky');
                cols.push('"' + (nameCol ? nameCol.innerText.replace(/\n/g, ' ').trim() : '') + '"');

                const checks = row.querySelectorAll('input[type="checkbox"]');
                checks.forEach(c => cols.push(c.checked ? "1" : "0"));

                cols.push(row.querySelector('.absences')?.innerText || "0");
            }
            csv.push(cols.join(","));
        });

        const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
        const downloadLink = document.createElement("a");
        downloadLink.download = `attendance_export_${new Date().toISOString().slice(0,10)}.csv`;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        
        this.showToast("Export downloaded!");
    },

    showToast(msg, isError = false) {
        const { toast, toastMsg } = this.dom;
        if (!toast) return;

        toastMsg.textContent = msg;
        toast.style.background = isError ? 'rgba(153, 27, 27, 0.95)' : 'rgba(16, 185, 129, 0.95)';
        toast.classList.add('visible');

        if (this.state.toastTimer) clearTimeout(this.state.toastTimer);
        this.state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => AttendanceApp.init());
