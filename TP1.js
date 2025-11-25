const AttendanceApp = {
    config: {
        colors: {
            good:   { class: 'status-good',    bg: '#dcfce7', gradient: 'linear-gradient(135deg, #10b981, #059669)' }, 
            warn:   { class: 'status-warning', bg: '#fef3c7', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' }, 
            danger: { class: 'status-danger',  bg: '#fee2e2', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' } 
        },
        thresholds: {
            warn: 1, 
            danger: 3 
        },
        apiEndpoint: 'attendance.php'
    },

    state: {
        pendingRequests: new Map() 
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.injectToolbar(); 
        this.refreshAllStats();
        console.log('Attendance App Initialized 🚀');
    },

    cacheDOM() {
        this.dom = {
            table: document.querySelector('.modern-table'),
            tbody: document.querySelector('tbody'),
            rows: document.querySelectorAll('tbody tr'),
            toast: document.getElementById('toast'),
            toastMsg: document.getElementById('toast-msg'),
            header: document.querySelector('.header')
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

        this.dom.rows.forEach(row => {
            if(!row.dataset.id) return; 
            
            const stats = this.calculateRowStats(row);
            this.updateRowVisuals(row, stats);
            
            totalStudents++;
            if(stats.abs >= this.config.thresholds.danger) totalAtRisk++;
        });

        this.updateGlobalDashboard(totalStudents, totalAtRisk);
    },

    updateRowVisuals(row, stats) {
        const absEl = row.querySelector('.absences');
        const partEl = row.querySelector('.participation');
        if(absEl) absEl.textContent = stats.abs;
        if(partEl) partEl.textContent = stats.part;

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
            if (txt.includes('saved')) {
                this.showToast("Saved successfully");
            } else {
                throw new Error(txt);
            }
        })
        .catch(err => {
            console.error(err);
            this.showToast("Sync failed!", true);
            checkbox.checked = !checkbox.checked; 
        });
    },

    filterStudents(query) {
        const lowerQuery = query.toLowerCase();
        this.dom.rows.forEach(row => {
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
                cols.push(row.querySelector('.participation')?.innerText || "0");
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