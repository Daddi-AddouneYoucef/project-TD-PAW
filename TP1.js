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
        this.refreshAllStats();
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
            .catch(err => {
                console.error(err);
                this.showToast("Loaded demo mode (JSON fetch failed)", true);
            });
    },

    handleNewStudentSubmit() {
        const sid = document.getElementById('sid').value;
        const fname = document.getElementById('fname').value;
        const lname = document.getElementById('lname').value;
        const email = document.getElementById('email').value;

        const newStudent = { id: sid, fname: fname, lname: lname, email: email };
        
        this.renderRow(newStudent);
        this.dom.addForm.reset();
        this.showToast("Student Added (UI Only)");
        this.refreshAllStats();
    },

    renderRow(student) {
        const tr = document.createElement('tr');
        tr.dataset.id = student.id;
        
        const att = student.attendance || {};

        let weeksHTML = '';
        for(let i=1; i<=6; i++) {
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

        const emailDisplay = student.email ? `<div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">${student.email}</div>` : '';

        tr.innerHTML = `
            <td class="col-sticky">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:35px; height:35px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:0.9rem;">
                        ${student.fname.charAt(0)}${student.lname.charAt(0)}
                    </div>
                    <div>
                        <div class="s-name" style="font-weight:600; color:#0f172a;">${student.lname}, ${student.fname}</div>
                        <div class="s-id" style="font-size:0.8rem; color:#64748b;">
                            ID: ${student.id}
                        </div>
                        ${emailDisplay}
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
        const currentRows = document.querySelectorAll('tbody tr'); 
        currentRows.forEach(row => {
            const stats = this.calculateRowStats(row);
            this.updateRowVisuals(row, stats);
        });
    },

    updateRowVisuals(row, stats) {
        const absEl = row.querySelector('.absences');
        if(absEl) absEl.textContent = stats.abs;

        const avatar = row.querySelector('.avatar');
        
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
    },

    handleCheckboxChange(checkbox) {
        const row = checkbox.closest('tr');
        const stats = this.calculateRowStats(row);
        this.updateRowVisuals(row, stats);
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

$(document).ready(function() {
    
    let myChart = null;

    $('#btn-show-report').click(function() {
        $('#report-section').fadeIn();
        
        let totalStudents = $('tbody tr').length;
        let totalPresent = 0;
        let totalParticipated = 0;

        $('input[data-type="present"]:checked').each(function() { totalPresent++; });
        $('input[data-type="participated"]:checked').each(function() { totalParticipated++; });

        $('#stats-text').html(`
            <span>Total Students: ${totalStudents}</span>
            <span style="color:#10b981">Total Presences: ${totalPresent}</span>
            <span style="color:#4f46e5">Total Participations: ${totalParticipated}</span>
        `);

        const ctx = document.getElementById('attendanceChart').getContext('2d');
        
        if(myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Students', 'Total Check-ins (Present)', 'Total Participations'],
                datasets: [{
                    label: 'Class Activity Stats',
                    data: [totalStudents, totalPresent, totalParticipated],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(16, 185, 129, 0.5)',
                        'rgba(79, 70, 229, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(16, 185, 129, 1)',
                        'rgba(79, 70, 229, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    });

    $('#btn-close-report').click(function() {
        $('#report-section').fadeOut();
    });

    $(document).on('mouseenter', 'tbody tr', function() { $(this).addClass('jq-hover'); });
    $(document).on('mouseleave', 'tbody tr', function() { $(this).removeClass('jq-hover'); });

    $(document).on('click', 'tbody tr', function(e) {
        if($(e.target).is('input')) return;
        const name = $(this).find('.s-name').text();
        const abs = $(this).find('.absences').text();
        alert(`Student Details:\n\nName: ${name}\nAbsences: ${abs}`);
    });

    $('#btn-highlight-exc').click(function() {
        $('tbody tr').each(function() {
            const absCount = parseInt($(this).find('.absences').text());
            if(absCount < 3) {
                $(this).addClass('excellent-student');
            } else {
                $(this).removeClass('excellent-student');
            }
        });
    });

    $('#btn-reset-colors').click(function() {
        $('tbody tr').removeClass('excellent-student');
    });

    $('#jq-search').on('keyup', function() {
        const value = $(this).val().toLowerCase();
        $("#student-table-body tr").filter(function() {
            const nameText = $(this).find('.col-sticky').text().toLowerCase();
            $(this).toggle(nameText.indexOf(value) > -1)
        });
    });

    function sortTable(comparator) {
        const rows = $('tbody tr').get();
        rows.sort(comparator);
        $.each(rows, function(index, row) {
            $('tbody').append(row);
        });
    }

    $('#btn-sort-abs').click(function() {
        $('#sort-message').text('Currently sorted by: Absences (Ascending)');
        sortTable(function(a, b) {
            return parseInt($(a).find('.absences').text()) - parseInt($(b).find('.absences').text());
        });
    });

    $('#btn-sort-part').click(function() {
        $('#sort-message').text('Currently sorted by: Participation (Descending)');
        sortTable(function(a, b) {
            const countA = $(a).find('input[data-type="participated"]:checked').length;
            const countB = $(b).find('input[data-type="participated"]:checked').length;
            return countB - countA;
        });
    });

});

