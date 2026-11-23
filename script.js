const firebaseConfig = {
    apiKey: "AIzaSyBccleW9TJfmp8bFChKwmIx-68pBrSUe-Y",
    authDomain: "elsa-cbt.firebaseapp.com",
    projectId: "elsa-cbt",
    storageBucket: "elsa-cbt.firebasestorage.app",
    messagingSenderId: "366734551874",
    appId: "1:366734551874:web:5cf9df6268c85173cef6db",
    measurementId: "G-D52762GFD4"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Force Session Persistence
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(err => {
    console.log("Persistence note:", err.message);
});

const PERMITTED_ADMINS = ["naeemahuthman1@gmail.com", "uthmanwasiudele@gmail.com"];
let currentSelectedExamType = "JAMB";
let chosenDurationMinutes = 120;
let timerInterval = null;
let currentExamQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let flaggedQuestions = {};
let currentManagedTrack = "JAMB";
let isExamActive = false;
let activeProfileData = null;
let activeProfileId = null;
let availableExamSubjects = [];
let examStartTime = null;
let rawQuestionBankData = [];

// Automatic Inactivity Logout Timer (15 Minutes)
let inactivityLogoutTimer = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

function resetInactivityTimer() {
    if (isExamActive) {
        if (inactivityLogoutTimer) clearTimeout(inactivityLogoutTimer);
        return;
    }
    if (inactivityLogoutTimer) clearTimeout(inactivityLogoutTimer);
    if (auth.currentUser) {
        inactivityLogoutTimer = setTimeout(() => {
            alert("⏰ Inactivity Timeout: You have been automatically logged out after 15 minutes of inactivity to conserve server resources.");
            handleLogout();
        }, INACTIVITY_TIMEOUT_MS);
    }
}

['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, true);
});

const NIGERIAN_SUBJECTS = [
    "Mathematics", "Use of English", "Physics", "Chemistry", "Biology",
    "Agricultural Science", "Economics", "Government", "Literature-in-English",
    "Christian Religious Knowledge (CRK)", "Islamic Religious Knowledge (IRK)", "Geography",
    "Financial Accounting", "Commerce", "Civic Education", "Computer Studies"
].sort();

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('elsa_cbt_theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateThemeToggleUI(savedTheme);

    populateSubjectDropdowns();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeExplanationModal();
            closeQuestionModal();
            closeStudyModal();
            closeProfileModal();
            closeEditProfileModal();
            closeReassignModal();
            closeContactAdminModal();
        }
    });

    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('active-mobile-drawer');
});

function populateSubjectDropdowns() {
    const dropdowns = document.querySelectorAll('.subject-dropdown');
    dropdowns.forEach(select => {
        select.innerHTML = '<option value="">-- Select Subject --</option>';
        NIGERIAN_SUBJECTS.forEach(sub => {
            select.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    });
}

function toggleGlobalTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('elsa_cbt_theme', isDark ? 'dark' : 'light');
    updateThemeToggleUI(isDark ? 'dark' : 'light');
}

function updateThemeToggleUI(theme) {
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon && label) {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            label.innerText = 'Light Mode';
        } else {
            icon.className = 'fa-solid fa-moon';
            label.innerText = 'Dark Mode';
        }
    }
}

function togglePasswordVisibility(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.className = 'fa-solid fa-eye-slash password-toggle-icon';
    } else {
        input.type = 'password';
        iconEl.className = 'fa-solid fa-eye password-toggle-icon';
    }
}

document.addEventListener("visibilitychange", function() {
    if (document.hidden && isExamActive) {
        alert("⚠️ SECURITY WARNING: Tab switching detected! Your exam has been automatically submitted.");
        submitExamManually();
    }
});

auth.onAuthStateChanged((user) => {
    if (user) {
        routeUserDashboard(user.uid);
        initUserPresence(user.uid);
        resetInactivityTimer();
    } else {
        showLoggedOutUI();
    }
});

function validateGmailInput(inputEl) {
    const val = inputEl.value.trim().toLowerCase();
    const id = inputEl.id;
    let warningEl = null;

    if (id === 'loginEmail') warningEl = document.getElementById('loginEmailWarning');
    if (id === 'signupEmail') warningEl = document.getElementById('signupEmailWarning');
    if (id === 'teacherEmailInput') warningEl = document.getElementById('teacherEmailWarning');
    if (id === 'studentEmailInput') warningEl = document.getElementById('studentEmailWarning');
    if (id === 'editProfileEmail') warningEl = document.getElementById('editEmailWarning');

    if (val !== '' && !val.endsWith('@gmail.com')) {
        if (warningEl) warningEl.classList.remove('hidden');
        inputEl.style.borderColor = '#dc2626';
    } else {
        if (warningEl) warningEl.classList.add('hidden');
        inputEl.style.borderColor = 'var(--border-color)';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active-mobile-drawer');
        if (sidebar.classList.contains('active-mobile-drawer')) {
            overlay.style.display = 'block';
            overlay.classList.remove('hidden');
        } else {
            overlay.style.display = 'none';
            overlay.classList.add('hidden');
        }
    }
}

function handleMobileMenuNav() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('active-mobile-drawer');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.add('hidden');
        }
    }
}

function handleMobileMenuNav() {
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
}

function switchAuthTab(tab) {
    const indicator = document.getElementById('tabIndicator');
    const loginTab = document.getElementById('tabLogin');
    const signupTab = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        if (indicator) indicator.className = "tab-indicator login-active";
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        if (indicator) indicator.className = "tab-indicator signup-active";
    }
}

function toggleSignupRoleFields() {
    const role = document.getElementById('signupRole').value;
    const titleGroup = document.getElementById('signupTeacherTitleGroup');
    if (titleGroup) {
        titleGroup.style.display = (role === 'teacher') ? 'flex' : 'none';
    }
}

function openContactAdminModal() {
    document.getElementById('contactAdminModal').classList.remove('hidden');
}
function closeContactAdminModal() {
    document.getElementById('contactAdminModal').classList.add('hidden');
}

// Role-Based Portal Routing & UI Gating
// Updated Role-Based Portal Routing & UI Gating
function routeUserDashboard(uid) {
    db.collection('users').doc(uid).get().then((doc) => {
        let username = "User";
        let role = "student";
        let assignedClass = "None";

        if (doc.exists) {
            const data = doc.data();
            username = data.username || "User";
            role = data.role || "student";
            assignedClass = data.assignedClass || "None";
        }

        // Set Header Status
        document.getElementById('userStatusBadge').innerText = `${username} (${role.toUpperCase()})`;
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('hamburgerBtn').classList.remove('hidden');
        document.getElementById('welcomeUserName').innerText = username;
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSidebar').classList.remove('hidden');

        // Portal-Specific View & Section Control
        const roleMenu = document.getElementById('roleSpecificMenu');
        const adminNavLink = document.getElementById('navAdmin');
        const userDirectoryBox = document.getElementById('allUsersListContainer')?.closest('.welcome-box');

        if (role === 'admin') {
            if (roleMenu) roleMenu.style.display = 'block';
            if (adminNavLink) adminNavLink.style.display = 'block';
            if (userDirectoryBox) userDirectoryBox.style.display = 'block';
            showView('viewHome');
            fetchAllUsersList('ALL');
        } else if (role === 'teacher') {
            if (roleMenu) roleMenu.style.display = 'block';
            if (adminNavLink) adminNavLink.style.display = 'none'; // Teachers don't need heavy admin controls
            if (userDirectoryBox) userDirectoryBox.style.display = 'none'; // Hide general directory from teachers
            showView('viewHome');
        } else {
            // Student Portal Gating
            if (roleMenu) roleMenu.style.display = 'none';
            if (adminNavLink) roleMenu.style.display = 'none';
            if (userDirectoryBox) userDirectoryBox.style.display = 'none'; // Students cannot view user directories
            showView('viewHome');
        }

        updateDashboardCounters();
        fetchLeaderboard();
    });
}

function updateDashboardCounters() {
    db.collection('users').get().then(snapshot => {
        let studentsCount = 0;
        let teachersCount = 0;
        snapshot.forEach(doc => {
            let r = doc.data().role;
            if (r === 'student') studentsCount++;
            if (r === 'teacher') teachersCount++;
        });
        const st = document.getElementById('statTotalStudents');
        const tt = document.getElementById('statTotalTeachers');
        if (st) st.innerText = studentsCount;
        if (tt) tt.innerText = teachersCount;
    });

    db.collection('classes').get().then(snapshot => {
        const tc = document.getElementById('statTotalClasses');
        if (tc) tc.innerText = snapshot.size;
    });

    db.collection('questions').get().then(snapshot => {
        const tq = document.getElementById('statTotalQuestions');
        if (tq) tq.innerText = snapshot.size;
    });
}

function showView(viewId) {
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active-simulator'));
    if (viewId === 'viewHome' && document.getElementById('navHome')) document.getElementById('navHome').classList.add('active-simulator');
    if (viewId === 'viewHistory' && document.getElementById('navHistory')) document.getElementById('navHistory').classList.add('active-simulator');
    if (viewId === 'viewAdmin' && document.getElementById('navAdmin')) {
        document.getElementById('navAdmin').classList.add('active-simulator');
        switchAdminTab('classes');
    }
}

// ==========================================
// REAL-TIME ACTIVE PRESENCE & USER DIRECTORY
// ==========================================
let presenceInterval = null;

function initUserPresence(uid) {
    if (!uid) return;
    const updatePresence = () => {
        db.collection('users').doc(uid).set({
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true
        }, { merge: true }).catch(err => console.log("Presence heartbeat error:", err));
    };

    updatePresence();
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(updatePresence, 60000); // Heartbeat every 60 seconds
}

function fetchAllUsersList(filterType) {
    const container = document.getElementById('allUsersListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading user directory...</p>`;

    ['All', 'Active', 'Inactive'].forEach(f => {
        const btn = document.getElementById(`userFilter${f}Btn`);
        if (btn) btn.className = f.toLowerCase() === filterType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    db.collection('users').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No users registered.</p>`;
            return;
        }

        let users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

        let html = '';
        let count = 0;
        const now = new Date().getTime();

        users.forEach(u => {
            let lastActiveTime = u.lastActive ? u.lastActive.toDate().getTime() : 0;
            // Only users active in the last 3 minutes show the active status
            let isCurrentlyOnline = (now - lastActiveTime) < 3 * 60 * 1000;

            if (filterType === 'active' && !isCurrentlyOnline) return;
            if (filterType === 'inactive' && isCurrentlyOnline) return;

            count++;
            let passportPreview = u.passportUrl 
                ? `<img src="${u.passportUrl}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--naija-green);">` 
                : `<div style="width: 34px; height: 34px; background: var(--naija-green-light); color: var(--naija-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;"><i class="fa-solid fa-user"></i></div>`;

            html += `
                <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${passportPreview}
                        <div>
                            <b>${u.username}</b> (${u.email})<br>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Role: <b>${(u.role || 'student').toUpperCase()}</b> | Class: <b>${u.assignedClass || 'None'}</b> | Phone: <b>${u.phone || 'N/A'}</b></span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="status-pill ${isCurrentlyOnline ? 'online' : 'offline'}">
                            ${isCurrentlyOnline ? 'Online Now' : 'Offline'}
                        </span>
                        <button onclick="openProfileModal('${u.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-address-card"></i> View Profile</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = count > 0 ? html : `<p style="color: var(--text-muted); font-size: 0.85rem;">No users match this filter.</p>`;
    });
}

// ==========================================
// CBT SIMULATOR ENGINE
// ==========================================
function launchExamMode(examType) {
    currentSelectedExamType = examType;
    showView('viewCBT');
    isExamActive = false;
    
    document.getElementById('standaloneCbtWindow').classList.add('hidden');
    document.getElementById('standaloneResultsWindow').classList.add('hidden');
    document.getElementById('cbtCustomizerCard').classList.remove('hidden');
    
    const bannerTitle = document.getElementById('cbtExamTitle');
    const bannerRules = document.getElementById('cbtExamRules');
    const modesContainer = document.getElementById('cbtModesContainer');
    const subjectSelectorArea = document.getElementById('subjectCountSelectorArea');

    if (examType === 'JAMB') {
        bannerTitle.innerText = "JAMB Unified Tertiary Matriculation Examination (UTME) Simulator";
        bannerRules.innerText = "Computer-Based Test featuring Use of English (60 Qs) and 3 chosen academic subjects (40 Qs each). Total 180 Qs.";
        if (subjectSelectorArea) subjectSelectorArea.style.display = 'none';
        if (modesContainer) modesContainer.style.display = 'flex';
        chosenDurationMinutes = 120;
        selectTestDuration(120);
        generateJAMBSubjects();
    } else {
        bannerTitle.innerText = `${examType} Senior School Certificate Examination Simulator`;
        bannerRules.innerText = `Select your preferred subjects (50 questions per subject). Total questions and time adjust dynamically.`;
        if (subjectSelectorArea) subjectSelectorArea.style.display = 'block';
        if (modesContainer) modesContainer.style.display = 'flex';
        const sc = document.getElementById('subjectCountSelect');
        if (sc) sc.value = "4";
        generateSubjectDropdowns();
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active-simulator'));
    const navBtn = document.getElementById(`nav${examType}`);
    if (navBtn) navBtn.classList.add('active-simulator');

    fetchAvailableSubjectsForExam(examType);
}

function fetchAvailableSubjectsForExam(examType) {
    db.collection('questions')
      .where('examType', '==', examType)
      .get()
      .then(snapshot => {
          let subsSet = new Set();
          snapshot.forEach(doc => {
              let data = doc.data();
              if (data.subject && data.isPublished !== false) subsSet.add(data.subject);
          });
          availableExamSubjects = Array.from(subsSet).sort();
      });
}

function clearSubjectSelection() {
    document.querySelectorAll('.subject-picker').forEach(sel => sel.value = '');
    checkProceedExamButton();
}

function generateJAMBSubjects() {
    const container = document.getElementById('dynamicSubjectsContainer');
    if (!container) return;
    let options = `<option value="">-- Select Subject --</option>`;
    let subjectsToDisplay = availableExamSubjects.length > 0 ? availableExamSubjects.filter(s => s !== "Use of English") : NIGERIAN_SUBJECTS.filter(s => s !== "Use of English");
    
    subjectsToDisplay.forEach(sub => {
        options += `<option value="${sub}">${sub}</option>`;
    });

    container.innerHTML = `
        <div style="padding: 10px; background: var(--naija-green-light); border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.85rem; font-weight: bold; color: var(--naija-green-dark); margin-bottom: 8px;">
            Subject 1: Use of English (Compulsory - Questions 1 to 60)
        </div>
    `;

    for (let i = 2; i <= 4; i++) {
        let startQ = 61 + (i - 2) * 40;
        let endQ = startQ + 39;
        container.innerHTML += `
            <div style="margin-bottom: 8px;">
                <label class="form-label">Subject ${i} (Questions ${startQ} to ${endQ})</label>
                <select class="form-select subject-picker" onchange="checkProceedExamButton()">${options}</select>
            </div>
        `;
    }
    checkProceedExamButton();
}

function generateSubjectDropdowns() {
    const countSelect = document.getElementById('subjectCountSelect');
    const count = countSelect ? parseInt(countSelect.value) || 4 : 4;
    const container = document.getElementById('dynamicSubjectsContainer');
    if (!container) return;
    container.innerHTML = '';

    let options = `<option value="">-- Select Subject --</option>`;
    let subjectsToDisplay = availableExamSubjects.length > 0 ? availableExamSubjects : NIGERIAN_SUBJECTS;
    subjectsToDisplay.forEach(sub => {
        options += `<option value="${sub}">${sub}</option>`;
    });

    for (let i = 1; i <= count; i++) {
        let startQ = 1 + (i - 1) * 50;
        let endQ = i * 50;
        container.innerHTML += `
            <div style="margin-bottom: 8px;">
                <label class="form-label">Subject ${i} (Questions ${startQ} to ${endQ})</label>
                <select class="form-select subject-picker" onchange="checkProceedExamButton()">${options}</select>
            </div>
        `;
    }

    chosenDurationMinutes = count * 60;
    const modeContainer = document.getElementById('cbtModesContainer');
    if (modeContainer) {
        modeContainer.innerHTML = `
            <div style="background: var(--naija-green-light); border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; text-align: center; margin-bottom: 12px;">
                <h3 style="color: var(--naija-green-dark); font-size: 1.3rem; margin-top: 4px;">${count} Subject${count > 1 ? 's' : ''} = ${count * 50} Total Questions</h3>
                <span style="font-size: 0.85rem; color: #166534; font-weight: bold;">Total Time Allowed: ${chosenDurationMinutes} Minutes (${count} Hour${count > 1 ? 's' : ''})</span>
            </div>
            <button id="proceedExamBtn" onclick="launchStandaloneExam()" class="primary-btn muted-btn" disabled style="opacity: 0.5; cursor: not-allowed; width: 100%;">Proceed to Exam</button>
        `;
    }
    checkProceedExamButton();
}

function selectTestDuration(mins) {
    chosenDurationMinutes = mins;
    const pBtn = document.getElementById('btnPracticeMode');
    const fBtn = document.getElementById('btnFullTestMode');
    if (pBtn && fBtn) {
        pBtn.className = mins === 40 ? "mode-box active-mode" : "mode-box";
        fBtn.className = mins === 120 ? "mode-box active-mode" : "mode-box";
    }
}

function checkProceedExamButton() {
    const pickers = document.querySelectorAll('.subject-picker');
    const proceedBtn = document.getElementById('proceedExamBtn');
    let allSelected = pickers.length > 0;
    pickers.forEach(p => { if (!p.value) allSelected = false; });

    if (proceedBtn) {
        proceedBtn.disabled = !allSelected;
        proceedBtn.style.opacity = allSelected ? '1' : '0.5';
        proceedBtn.style.cursor = allSelected ? 'pointer' : 'not-allowed';
        if (allSelected) proceedBtn.classList.remove('muted-btn');
        else proceedBtn.classList.add('muted-btn');
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function launchStandaloneExam() {
    document.getElementById('cbtCustomizerCard').classList.add('hidden');
    document.getElementById('standaloneCbtWindow').classList.remove('hidden');
    document.getElementById('standaloneExamBadge').innerText = `${currentSelectedExamType} CBT`;
    isExamActive = true;
    userAnswers = {};
    flaggedQuestions = {};
    currentQuestionIndex = 0;
    examStartTime = new Date();

    let selectedSubjects = [];
    if (currentSelectedExamType === 'JAMB') {
        selectedSubjects.push({ subject: "Use of English", count: (chosenDurationMinutes === 40 ? 20 : 60), startIdx: 0 });
        let currentOffset = (chosenDurationMinutes === 40 ? 20 : 60);
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if (sel.value) {
                let cnt = (chosenDurationMinutes === 40 ? 10 : 40);
                selectedSubjects.push({ subject: sel.value, count: cnt, startIdx: currentOffset });
                currentOffset += cnt;
            }
        });
    } else {
        let currentOffset = 0;
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if (sel.value) {
                selectedSubjects.push({ subject: sel.value, count: 50, startIdx: currentOffset });
                currentOffset += 50;
            }
        });
        chosenDurationMinutes = selectedSubjects.length * 60;
    }

    db.collection('questions')
      .where('examType', '==', currentSelectedExamType)
      .get()
      .then((snapshot) => {
          if (snapshot.empty) {
              alert(`No published questions found in database for ${currentSelectedExamType}!`);
              closeStandaloneCbtWindow();
              return;
          }

          let allDbQuestions = [];
          snapshot.forEach((doc) => {
              let data = doc.data();
              if (data.isPublished !== false) {
                  allDbQuestions.push({ id: doc.id, ...data });
              }
          });

          let assembledPaper = [];
          selectedSubjects.forEach(subObj => {
              let subPool = allDbQuestions.filter(q => q.subject === subObj.subject);
              subPool = shuffleArray(subPool);
              let sliced = subPool.slice(0, subObj.count);
              
              while (sliced.length < subObj.count && subPool.length > 0) {
                  let extra = subPool[Math.floor(Math.random() * subPool.length)];
                  sliced.push({ ...extra, id: extra.id + '_' + Math.random() });
              }
              assembledPaper = assembledPaper.concat(sliced);
          });

          if (assembledPaper.length === 0) {
              alert("No published questions available for the selected subjects.");
              closeStandaloneCbtWindow();
              return;
          }

          currentExamQuestions = assembledPaper;
          renderSubjectTabs(selectedSubjects);
          renderQuestionPalette();
          displayCurrentQuestion();
          startTimer(chosenDurationMinutes * 60);
      })
      .catch((err) => {
          alert("Error launching CBT: " + err.message);
          closeStandaloneCbtWindow();
      });
}

function renderSubjectTabs(subjects) {
    const container = document.getElementById('cbtSubjectTabsHeader');
    if (!container) return;
    container.innerHTML = '';
    subjects.forEach((subObj, idx) => {
        container.innerHTML += `
            <button onclick="jumpToSubjectStart('${subObj.subject}', ${subObj.startIdx})" id="cbtSubjectTab_${idx}" class="cbt-subject-tab ${idx === 0 ? 'active' : ''}">${subObj.subject}</button>
        `;
    });
}

function displayCurrentQuestion() {
    if (currentExamQuestions.length === 0) return;
    const q = currentExamQuestions[currentQuestionIndex];

    const numLabel = document.getElementById('cbtQuestionNumberLabel');
    const bodyText = document.getElementById('cbtQuestionBodyText');
    const metaText = document.getElementById('cleanMetaText');
    const subjectTitle = document.getElementById('cbtSubjectTitle');

    if (numLabel) numLabel.innerText = `Question ${currentQuestionIndex + 1} of ${currentExamQuestions.length}`;
    if (subjectTitle) subjectTitle.innerText = q.subject;
    if (metaText) metaText.innerText = `${q.examType || currentSelectedExamType} • Year: ${q.year || 2026} • Question #${currentQuestionIndex + 1}`;

    document.querySelectorAll('.cbt-subject-tab').forEach(tabBtn => {
        tabBtn.classList.toggle('active', tabBtn.innerText.trim() === q.subject);
    });

    let imgHtml = q.imageUrl ? `<div style="margin-bottom:12px;"><img src="${q.imageUrl}" style="max-width:100%; max-height:220px; border-radius:6px; border:1px solid var(--border-color);"></div>` : '';
    if (bodyText) {
        bodyText.innerHTML = `
            <p style="margin-bottom: 12px; font-weight: 600;">${q.questionText}</p>
            ${imgHtml}
        `;
    }

    const optionsContainer = document.getElementById('cbtOptionsContainer');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(optKey => {
            if (q.options && q.options[optKey]) {
                const isSelected = userAnswers[q.id] === optKey;
                optionsContainer.innerHTML += `
                    <div onclick="selectOption('${optKey}')" class="cbt-option-item ${isSelected ? 'selected' : ''}">
                        <b>${optKey}.</b> ${q.options[optKey]}
                    </div>
                `;
            }
        });
    }

    const flagBtn = document.getElementById('flagQuestionBtn');
    if (flagBtn) {
        flagBtn.className = flaggedQuestions[q.id] ? 'flag-btn flagged' : 'flag-btn';
        flagBtn.innerHTML = flaggedQuestions[q.id] ? `<i class="fa-solid fa-flag"></i> Flagged` : `<i class="fa-solid fa-flag"></i> Flag Question`;
    }

    renderQuestionPalette();
}

function selectOption(optKey) {
    const q = currentExamQuestions[currentQuestionIndex];
    userAnswers[q.id] = optKey;
    displayCurrentQuestion();
}

function clearCurrentSelection() {
    const q = currentExamQuestions[currentQuestionIndex];
    delete userAnswers[q.id];
    displayCurrentQuestion();
}

function toggleFlagCurrentQuestion() {
    const q = currentExamQuestions[currentQuestionIndex];
    flaggedQuestions[q.id] = !flaggedQuestions[q.id];
    displayCurrentQuestion();
}

function navigateCbtQuestion(step) {
    const newIdx = currentQuestionIndex + step;
    if (newIdx >= 0 && newIdx < currentExamQuestions.length) {
        currentQuestionIndex = newIdx;
        displayCurrentQuestion();
    }
}

function renderQuestionPalette() {
    const paletteGrid = document.getElementById('cbtQuestionPaletteGrid');
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';

    currentExamQuestions.forEach((q, idx) => {
        let statusClass = '';
        if (userAnswers[q.id]) statusClass = 'answered';
        if (flaggedQuestions[q.id]) statusClass = 'flagged';
        if (idx === currentQuestionIndex) statusClass += ' current';

        paletteGrid.innerHTML += `
            <button onclick="jumpToQuestion(${idx})" class="palette-num-btn ${statusClass}">${idx + 1}</button>
        `;
    });
}

function jumpToQuestion(idx) {
    currentQuestionIndex = idx;
    displayCurrentQuestion();
}

function jumpToSubjectStart(subjectName, startIdx) {
    if (startIdx !== undefined && startIdx < currentExamQuestions.length) {
        currentQuestionIndex = startIdx;
    } else {
        const targetIdx = currentExamQuestions.findIndex(q => q.subject === subjectName);
        if (targetIdx !== -1) currentQuestionIndex = targetIdx;
    }
    displayCurrentQuestion();
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    let timeRemaining = seconds;

    timerInterval = setInterval(() => {
        let hours = Math.floor(timeRemaining / 3600);
        let mins = Math.floor((timeRemaining % 3600) / 60);
        let secs = timeRemaining % 60;
        
        let displayStr = hours > 0 
            ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        const timerEl = document.getElementById('cbtTimer');
        if (timerEl) timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${displayStr}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Time is up! Examination submitted automatically.");
            submitExamManually();
        }
        timeRemaining--;
    }, 1000);
}

function closeStandaloneCbtWindow() {
    if (confirm("Are you sure you want to exit the CBT simulator? Progress will be lost.")) {
        clearInterval(timerInterval);
        isExamActive = false;
        document.getElementById('standaloneCbtWindow').classList.add('hidden');
        launchExamMode(currentSelectedExamType);
    }
}

function toggleCBTCalculator() {
    const calcBox = document.getElementById('cbtCalculatorBox');
    if (calcBox) calcBox.classList.toggle('hidden');
}
function calcClear() { const screen = document.getElementById('calcScreen'); if (screen) screen.value = '0'; }
function calcAppend(val) {
    let screen = document.getElementById('calcScreen');
    if (screen) screen.value = (screen.value === '0' && val !== '.') ? val : screen.value + val;
}
function calcBack() {
    let screen = document.getElementById('calcScreen');
    if (screen) screen.value = screen.value.slice(0, -1) || '0';
}
function calcCompute() {
    let screen = document.getElementById('calcScreen');
    if (screen) {
        try { screen.value = eval(screen.value.replace('×', '*')) || '0'; }
        catch(e) { screen.value = 'Error'; }
    }
}

function getWaecNecoGrade(percentage) {
    if (percentage >= 75) return { grade: "A1", remark: "Excellent", status: "Distinction" };
    if (percentage >= 70) return { grade: "B2", remark: "Very Good", status: "Distinction" };
    if (percentage >= 65) return { grade: "B3", remark: "Good", status: "Distinction" };
    if (percentage >= 60) return { grade: "C4", remark: "Credit", status: "Credit" };
    if (percentage >= 55) return { grade: "C5", remark: "Credit", status: "Credit" };
    if (percentage >= 50) return { grade: "C6", remark: "Credit", status: "Minimum Credit" };
    if (percentage >= 45) return { grade: "D7", remark: "Pass", status: "Ordinary Pass" };
    if (percentage >= 40) return { grade: "E8", remark: "Pass", status: "Ordinary Pass" };
    return { grade: "F9", remark: "Fail", status: "Outright Fail" };
}

// ==========================================
// DETAILED EXAM RESULTS & COLOR-CODED REVIEW
// ==========================================
function submitExamManually() {
    clearInterval(timerInterval);
    isExamActive = false;
    document.getElementById('standaloneCbtWindow').classList.add('hidden');
    document.getElementById('standaloneResultsWindow').classList.remove('hidden');

    let totalQuestions = currentExamQuestions.length;
    let totalCorrect = 0;
    let subjectStats = {};
    let reviewLogArray = [];
    let timeUsedSecs = examStartTime ? Math.round((new Date() - examStartTime) / 1000) : 0;
    let timeUsedStr = `${Math.floor(timeUsedSecs / 60)} mins ${timeUsedSecs % 60} secs`;

    currentExamQuestions.forEach((q, idx) => {
        const userChoice = userAnswers[q.id] || "NONE";
        const isCorrect = userChoice === q.correctOption;

        if (!subjectStats[q.subject]) subjectStats[q.subject] = { total: 0, correct: 0 };
        subjectStats[q.subject].total += 1;

        if (isCorrect) {
            totalCorrect += 1;
            subjectStats[q.subject].correct += 1;
        }

        reviewLogArray.push({
            number: idx + 1,
            subject: q.subject,
            questionText: q.questionText,
            imageUrl: q.imageUrl || "",
            options: q.options || {},
            userChoice: userChoice,
            correctOption: q.correctOption,
            isCorrect: isCorrect,
            explanation: q.explanation || "No detailed explanation provided."
        });
    });

    let percentage = Math.round((totalCorrect / (totalQuestions || 1)) * 100);
    let finalScaledScore = currentSelectedExamType === 'JAMB' ? Math.round((totalCorrect / (totalQuestions || 1)) * 400) : percentage;

    renderExamSlipUI(currentSelectedExamType, percentage, finalScaledScore, subjectStats, timeUsedStr, new Date().toLocaleString(), reviewLogArray);
    saveExamResultToFirestore(currentSelectedExamType, percentage, totalCorrect, totalQuestions, finalScaledScore, subjectStats, timeUsedStr, reviewLogArray);
}

function renderExamSlipUI(examType, percentage, scaledScore, subjectStats, timeUsedStr, dateLabel, reviewLogArray) {
    document.getElementById('overallPercentageBadge').innerText = `${percentage}%`;
    document.getElementById('resultsTimestamp').innerText = `Completed in ${timeUsedStr} on ${dateLabel}`;

    let gradeStatusText = "";
    if (examType === 'JAMB') {
        document.getElementById('resTotalScore').innerText = `${scaledScore} / 400`;
        document.getElementById('resScoreHeaderLabel').innerText = `JAMB SCORE (/400)`;
        gradeStatusText = scaledScore >= 200 ? "PASSED (ADMISSIBLE)" : "NEEDS IMPROVEMENT";
    } else {
        let overallGradeObj = getWaecNecoGrade(percentage);
        document.getElementById('resTotalScore').innerText = `${overallGradeObj.grade} (${percentage}%)`;
        document.getElementById('resScoreHeaderLabel').innerText = `${examType} SCORE / GRADE`;
        gradeStatusText = `${overallGradeObj.grade} - ${overallGradeObj.remark} (${overallGradeObj.status})`;
    }
    document.getElementById('resGradeStatus').innerText = gradeStatusText;

    let weakestSub = "None";
    let lowestPercentage = 101;
    let breakdownHTML = '';

    for (let sub in subjectStats) {
        let subCorrect = subjectStats[sub].correct;
        let subTotal = subjectStats[sub].total;
        let subAcc = Math.round((subCorrect / subTotal) * 100);
        if (subAcc < lowestPercentage) {
            lowestPercentage = subAcc;
            weakestSub = sub;
        }
        let subExtraInfo = examType !== 'JAMB' ? ` | Grade: <b>${getWaecNecoGrade(subAcc).grade}</b>` : "";
        breakdownHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-gray); padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 4px;">
                <span><b>${sub}</b> (${subCorrect}/${subTotal})${subExtraInfo}</span>
                <span style="font-weight: bold; color: ${subAcc >= 50 ? 'var(--naija-green)' : '#dc2626'};">${subAcc}%</span>
            </div>
        `;
    }
    document.getElementById('resWeakSubject').innerText = weakestSub === "None" ? "None" : `${weakestSub} (${lowestPercentage}%)`;
    document.getElementById('resSubjectBreakdownList').innerHTML = breakdownHTML;

    // Detailed CBT Corrections Review with Color-Coding & Explanation Modal Button
    let reviewHTML = '';
    if (reviewLogArray && reviewLogArray.length > 0) {
        reviewLogArray.forEach((item, index) => {
            let optionsReviewHTML = '';
            ['A', 'B', 'C', 'D'].forEach(optKey => {
                if (item.options && item.options[optKey]) {
                    let bg = 'var(--bg-gray)';
                    let color = 'var(--text-color)';
                    let border = '1px solid var(--border-color)';
                    let statusTag = '';

                    if (optKey === item.correctOption) {
                        bg = 'rgba(0, 135, 81, 0.15)';
                        color = '#008751';
                        border = '1px solid #008751';
                        statusTag = ' <b>(Correct Answer ✓)</b>';
                    }
                    if (optKey === item.userChoice && !item.isCorrect) {
                        bg = 'rgba(220, 38, 38, 0.15)';
                        color = '#dc2626';
                        border = '1px solid #dc2626';
                        statusTag = ' <b>(Your Pick - Wrong ✗)</b>';
                    } else if (optKey === item.userChoice && item.isCorrect) {
                        statusTag = ' <b>(Your Pick - Correct ✓)</b>';
                    }

                    optionsReviewHTML += `
                        <div style="padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; background: ${bg}; color: ${color}; border: ${border}; font-size: 0.85rem;">
                            <b>${optKey}.</b> ${item.options[optKey]} ${statusTag}
                        </div>
                    `;
                }
            });

            let imgBlock = item.imageUrl ? `<div style="margin: 8px 0;"><img src="${item.imageUrl}" style="max-width: 100%; max-height: 180px; border-radius: 6px;"></div>` : '';
            let safeExplanation = (item.explanation || "No explanation available.").replace(/'/g, "\\'").replace(/"/g, '&quot;');

            reviewHTML += `
                <div style="padding: 14px; border-bottom: 1px solid var(--border-color); background: var(--card-bg); margin-bottom: 10px; border-radius: 8px; border-left: 4px solid ${item.isCorrect ? 'var(--naija-green)' : '#dc2626'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                        <p style="font-weight: bold; font-size: 0.9rem; color: var(--text-color);">
                            ${item.number || index + 1}. [${item.subject}] ${item.questionText}
                        </p>
                        <span style="font-size: 0.75rem; font-weight: bold; padding: 2px 8px; border-radius: 4px; background: ${item.isCorrect ? 'var(--naija-green-light)' : '#fee2e2'}; color: ${item.isCorrect ? 'var(--naija-green-dark)' : '#dc2626'}; white-space: nowrap;">
                            ${item.isCorrect ? 'Correct ✓' : 'Wrong ✗'}
                        </span>
                    </div>
                    ${imgBlock}
                    <div style="margin-bottom: 10px;">${optionsReviewHTML}</div>
                    <button onclick="openExplanationModal('${item.correctOption}', '${safeExplanation}')" class="primary-btn" style="background: #2563eb; padding: 6px 12px; font-size: 0.8rem;">
                        <i class="fa-solid fa-lightbulb"></i> View Explanation
                    </button>
                </div>
            `;
        });
    } else {
        reviewHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Detailed question log was not archived for this legacy session.</p>`;
    }

    document.getElementById('resDetailedReviewList').innerHTML = reviewHTML;
}

function closeStandaloneResultsWindow() {
    document.getElementById('standaloneResultsWindow').classList.add('hidden');
    showView('viewHome');
}

function saveExamResultToFirestore(examType, percentage, score, total, scaledScore, subjectStats, timeUsedStr, reviewLogArray) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userDisplayName = document.getElementById('welcomeUserName')?.innerText || auth.currentUser.email;

    db.collection('exam_results').add({
        userId: uid,
        studentName: userDisplayName,
        examType: examType,
        percentage: percentage,
        score: score,
        total: total,
        scaledScore: scaledScore,
        subjectStats: subjectStats,
        timeUsed: timeUsedStr,
        reviewLog: reviewLogArray,
        timestamp: new Date()
    });
}

// ==========================================
// EXAM RECORDS & HISTORY (FIXED FIRESTORE QUERY)
// ==========================================
function showExamHistoryView() {
    showView('viewHistory');
    const container = document.getElementById('examHistoryListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted);">Loading exam records & student history...</p>`;

    if (!auth.currentUser) return;
    const currentUid = auth.currentUser.uid;

    // Query without orderBy to avoid composite index failures, then sort in JS
    db.collection('exam_results').where('userId', '==', currentUid).get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted);">No exam records logged yet. Complete a simulator session to see your records here!</p>`;
            return;
        }

        let records = [];
        snapshot.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
        records.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
        records.forEach(res => {
            let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Recent';
            let formattedScore = res.examType === 'JAMB' ? `${res.scaledScore} / 400` : `${getWaecNecoGrade(res.percentage).grade} (${res.percentage}%)`;

            html += `
                <div style="background: var(--card-bg); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <b>${res.examType} Exam Session</b> • Score: <b style="color: var(--naija-green);">${formattedScore}</b><br>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Completed in ${res.timeUsed || 'N/A'} on ${dateStr}</span>
                    </div>
                    <button onclick="inspectPastExamSlip('${res.id}')" class="primary-btn" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-eye"></i> View Slip & Corrections</button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    }).catch(err => {
        container.innerHTML = `<p style="color: #dc2626;">Error loading records: ${err.message}</p>`;
    });
}

function inspectPastExamSlip(resId) {
    db.collection('exam_results').doc(resId).get().then(doc => {
        if (doc.exists) {
            let res = doc.data();
            let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Past Session';
            renderExamSlipUI(
                res.examType,
                res.percentage,
                res.scaledScore || res.percentage,
                res.subjectStats || {},
                res.timeUsed || 'N/A',
                dateStr,
                res.reviewLog || []
            );
            document.getElementById('standaloneResultsWindow').classList.remove('hidden');
        }
    });
}

// ==========================================
// ADMIN CONTROL PANEL TABS
// ==========================================
function switchAdminTab(tab) {
    const panels = ['Classes', 'Teachers', 'Students', 'Questions', 'Images', 'Videos', 'Results'];
    panels.forEach(p => {
        const panelEl = document.getElementById(`adminPanel${p}`);
        const btnEl = document.getElementById(`adminTabBtn${p}`);
        if (panelEl) panelEl.classList.add('hidden');
        if (btnEl) btnEl.classList.remove('active');
    });

    const activeCap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const activePanel = document.getElementById(`adminPanel${activeCap}`);
    const activeBtn = document.getElementById(`adminTabBtn${activeCap}`);

    if (activePanel) activePanel.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');

    if (tab === 'classes') fetchClassesList();
    if (tab === 'teachers') { populateClassDropdowns(); fetchTeachersList(); }
    if (tab === 'students') { populateClassDropdowns(); fetchStudentsList(); }
    if (tab === 'questions') fetchQuestionsForManagement('JAMB');
    if (tab === 'images') fetchImageBank();
    if (tab === 'videos') fetchAdminVideos();
    if (tab === 'results') { populateClassDropdowns(); fetchAdminResultsLog(); }
}

function fetchAdminResultsLog() {
    const container = document.getElementById('adminResultsLog');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading student results log...</p>`;

    db.collection('exam_results').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No student scores recorded yet.</p>`;
            return;
        }

        let results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        results.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        let html = `<div style="display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;">`;
        results.forEach(res => {
            let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Recent';
            let formattedScore = res.examType === 'JAMB' ? `${res.scaledScore} / 400` : `${getWaecNecoGrade(res.percentage).grade} (${res.percentage}%)`;

            html += `
                <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <b>${res.studentName || 'Student'} — ${res.examType} Exam Log</b><br>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Score: <b>${formattedScore}</b> | Time: ${res.timeUsed || 'N/A'} | Logged: ${dateStr}</span>
                    </div>
                    <button onclick="inspectPastExamSlip('${res.id}')" class="primary-btn" style="padding: 4px 10px; font-size: 0.75rem;"><i class="fa-solid fa-eye"></i> View CBT Slip</button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    });
}

function clearAllResultsLog() {
    if (confirm("Are you sure you want to clear all exam result logs?")) {
        db.collection('exam_results').get().then(snapshot => {
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            return batch.commit();
        }).then(() => {
            alert("Results log cleared successfully!");
            fetchAdminResultsLog();
        });
    }
}

// ==========================================
// IMAGE BANK & COPIER (FOR CSV DIAGRAMS)
// ==========================================
let tempImageBankBase64 = "";

function previewImageBankUpload(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            tempImageBankBase64 = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveImageToBank() {
    const titleInput = document.getElementById('imageBankTitle');
    const title = titleInput ? titleInput.value.trim() || "Diagram Image" : "Diagram Image";
    const fileInput = document.getElementById('imageBankFileInput');

    if (!tempImageBankBase64) {
        alert("Please select an image file to upload.");
        return;
    }

    db.collection('image_bank').add({
        title: title,
        url: tempImageBankBase64,
        createdAt: new Date()
    }).then(() => {
        alert("Image added to Image Bank successfully!");
        if (titleInput) titleInput.value = '';
        if (fileInput) fileInput.value = '';
        tempImageBankBase64 = "";
        fetchImageBank();
    }).catch(err => alert("Upload error: " + err.message));
}

function fetchImageBank() {
    const container = document.getElementById('imageBankListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading image bank...</p>`;

    db.collection('image_bank').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No images uploaded to Image Bank yet.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let img = doc.data();
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-color); gap: 10px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="image-bank-checkbox" value="${img.url}" style="width: 16px; height: 16px; cursor: pointer;">
                        <img src="${img.url}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);">
                        <div>
                            <b>${img.title}</b><br>
                            <small style="color: var(--text-muted); font-size: 0.72rem; word-break: break-all;">${img.url.substring(0, 50)}...</small>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="copySingleImageLink('${doc.id}')" class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem; background: #2563eb;"><i class="fa-solid fa-copy"></i> Copy Link</button>
                        <button onclick="deleteBankImage('${doc.id}')" class="logout-btn" style="padding: 5px 10px; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

function copySingleImageLink(docId) {
    db.collection('image_bank').doc(docId).get().then(doc => {
        if (doc.exists) {
            navigator.clipboard.writeText(doc.data().url).then(() => {
                alert("✅ Image link copied to clipboard! Paste directly into your CSV file.");
            });
        }
    });
}

function copyBulkImageLinks() {
    const checkboxes = document.querySelectorAll('.image-bank-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Please tick at least one checkbox next to the images you want to bulk-copy.");
        return;
    }
    let selectedLinks = Array.from(checkboxes).map(cb => cb.value);
    navigator.clipboard.writeText(selectedLinks.join('\n')).then(() => {
        alert(`✅ Bulk copied ${selectedLinks.length} selected image link(s) to clipboard!`);
    });
}

function deleteBankImage(docId) {
    if (confirm("Delete this image from the Image Bank?")) {
        db.collection('image_bank').doc(docId).delete().then(() => fetchImageBank());
    }
}

// ==========================================
// CLASSES, TEACHERS & STUDENTS MANAGEMENT
// ==========================================
function createNewClass() {
    const classNameInput = document.getElementById('newClassNameInput');
    const className = classNameInput ? classNameInput.value.trim() : '';
    if (!className) {
        alert("Please enter a class name.");
        return;
    }

    db.collection('classes').add({
        className: className,
        createdAt: new Date()
    }).then(() => {
        alert(`Class "${className}" created successfully!`);
        if (classNameInput) classNameInput.value = '';
        fetchClassesList();
        populateClassDropdowns();
        updateDashboardCounters();
    }).catch(err => alert("Error creating class: " + err.message));
}

function fetchClassesList() {
    const container = document.getElementById('classListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading classes...</p>`;

    db.collection('classes').get().then(snapshot => {
        const header = document.getElementById('classesCountHeader');
        if (header) header.innerText = `All Created Classes & Rosters (${snapshot.size})`;

        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No custom classes created yet.</p>`;
            return;
        }

        db.collection('users').where('role', '==', 'student').get().then(studentSnap => {
            let studentCounts = {};
            studentSnap.forEach(doc => {
                let sClass = doc.data().assignedClass || "Unassigned";
                studentCounts[sClass] = (studentCounts[sClass] || 0) + 1;
            });

            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const studentEnrolledCount = studentCounts[data.className] || 0;
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <b>${data.className}</b> <span style="color: var(--text-muted); font-size: 0.75rem;">(${studentEnrolledCount} Students Enrolled)</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="viewClassRoster('${data.className}')" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="View Students"><i class="fa-solid fa-users"></i></button>
                            <button onclick="deleteClass('${doc.id}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Delete Class"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        });
    });
}

function deleteClass(docId) {
    if (confirm("Are you sure you want to delete this class?")) {
        db.collection('classes').doc(docId).delete().then(() => {
            fetchClassesList();
            populateClassDropdowns();
            updateDashboardCounters();
        });
    }
}

function viewClassRoster(className) {
    db.collection('users').where('assignedClass', '==', className).get().then(snapshot => {
        let rosterHTML = `<h3>Students in ${className} (${snapshot.size})</h3><div style="margin-top:10px; max-height:300px; overflow-y:auto;">`;
        if (snapshot.empty) {
            rosterHTML += `<p style="color: var(--text-muted); font-size: 0.85rem;">No students enrolled.</p>`;
        } else {
            snapshot.forEach(doc => {
                let s = doc.data();
                rosterHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-gray); padding:6px 10px; margin-bottom:4px; border-radius:4px; border:1px solid var(--border-color); font-size:0.85rem;">
                        <span><i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${s.username}</b> (${s.email})</span>
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 2px 6px; font-size: 0.75rem;">Profile</button>
                    </div>
                `;
            });
        }
        rosterHTML += `</div>`;
        document.getElementById('profileModalTitle').innerText = `Roster: ${className}`;
        document.getElementById('profileAvatarContainer').style.display = 'none';
        document.getElementById('profileModalBody').innerHTML = rosterHTML;
        document.getElementById('profileModal').classList.remove('hidden');
    });
}

function populateClassDropdowns() {
    db.collection('classes').get().then(snapshot => {
        let select = document.getElementById('studentClassDropdownSelect');
        let tSelect = document.getElementById('teacherClassDropdownSelect');
        let reselect = document.getElementById('reassignClassSelect');
        let editSelect = document.getElementById('editProfileClass');
        let filterTSelect = document.getElementById('filterTeacherClass');
        let filterSSelect = document.getElementById('filterStudentClass');
        
        let optionsHtml = '<option value="">-- Select Available Class --</option>';
        let reoptionsHtml = '<option value="None">-- Unassigned / None --</option>';
        let filterOptionsHtml = '<option value="ALL">All Classes</option>';

        snapshot.forEach(doc => {
            let cName = doc.data().className;
            optionsHtml += `<option value="${cName}">${cName}</option>`;
            reoptionsHtml += `<option value="${cName}">${cName}</option>`;
            filterOptionsHtml += `<option value="${cName}">${cName}</option>`;
        });

        if (select) select.innerHTML = optionsHtml;
        if (tSelect) tSelect.innerHTML = optionsHtml;
        if (reselect) reselect.innerHTML = reoptionsHtml;
        if (editSelect) editSelect.innerHTML = reoptionsHtml;
        if (filterTSelect && filterTSelect.options.length <= 1) filterTSelect.innerHTML = filterOptionsHtml;
        if (filterSSelect && filterSSelect.options.length <= 1) filterSSelect.innerHTML = filterOptionsHtml;
    });
}

function fetchTeachersList() {
    const container = document.getElementById('teachersListContainer');
    if (!container) return;
    const classFilter = document.getElementById('filterTeacherClass') ? document.getElementById('filterTeacherClass').value : 'ALL';
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading teachers...</p>`;

    db.collection('users').where('role', '==', 'teacher').get().then(teacherSnap => {
        const header = document.getElementById('teachersCountHeader');
        if (header) header.innerText = `All Registered Teachers (${teacherSnap.size})`;

        if (teacherSnap.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No teachers registered yet.</p>`;
            return;
        }

        let html = '';
        teacherSnap.forEach(doc => {
            let t = doc.data();
            let assignedClass = t.assignedClass || "None";
            if (classFilter !== 'ALL' && assignedClass !== classFilter) return;

            let titlePrefix = t.teacherTitle ? `${t.teacherTitle} ` : "";
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${titlePrefix}${t.username}</b> (${t.email})<br>
                        <span style="color: var(--text-muted); font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Phone: <b>${t.phone || 'N/A'}</b></span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;">Profile</button>
                        <button onclick="deleteTeacherAccount('${doc.id}')" class="logout-btn" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || `<p style="color: var(--text-muted); font-size: 0.85rem;">No teachers found for this filter.</p>`;
    });
}

function preRegisterTeacher() {
    const title = document.getElementById('teacherTitleSelect').value;
    const name = document.getElementById('teacherNameInput').value.trim();
    const email = document.getElementById('teacherEmailInput').value.trim().toLowerCase();
    const phone = document.getElementById('teacherPhoneInput').value.trim();
    const assignedClass = document.getElementById('teacherClassDropdownSelect').value;
    const gender = document.getElementById('teacherGenderSelect').value;

    if (!name || !email || !phone) {
        alert("Please enter teacher name, email, and phone number.");
        return;
    }
    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }

    db.collection('users').add({
        teacherTitle: title,
        username: name,
        email: email,
        phone: phone,
        role: 'teacher',
        assignedClass: assignedClass || 'None',
        gender: gender,
        isRegisteredByAdmin: true,
        createdAt: new Date()
    }).then(() => {
        alert(`Teacher ${title} ${name} pre-registered successfully!`);
        document.getElementById('teacherNameInput').value = '';
        document.getElementById('teacherEmailInput').value = '';
        document.getElementById('teacherPhoneInput').value = '';
        fetchTeachersList();
        updateDashboardCounters();
    });
}

function deleteTeacherAccount(docId) {
    if (confirm("Delete this teacher?")) {
        db.collection('users').doc(docId).delete().then(() => {
            fetchTeachersList();
            updateDashboardCounters();
        });
    }
}

function downloadTeacherCSVTemplate() {
    let csvContent = "teacher_title,username,email,phone,assignedClass,gender\nMr.,John Doe,john.doe@gmail.com,08012345678,SS 3 Gold,Male\n";
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elsa_teachers_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseTeacherCSV() {
    const fileInput = document.getElementById('teacherCsvFileInput');
    if (!fileInput || fileInput.files.length === 0) { alert("Select CSV file first."); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return;
        const batch = db.batch();
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(c => c.trim());
            if (row.length >= 4) {
                let docRef = db.collection('users').doc();
                batch.set(docRef, {
                    teacherTitle: row[0] || 'Mr.',
                    username: row[1],
                    email: row[2].toLowerCase(),
                    phone: row[3] || 'N/A',
                    assignedClass: row[4] || 'None',
                    gender: row[5] || 'Male',
                    role: 'teacher',
                    isRegisteredByAdmin: true,
                    createdAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`Uploaded ${count} teachers successfully!`);
            fileInput.value = '';
            fetchTeachersList();
            updateDashboardCounters();
        });
    };
    reader.readAsText(fileInput.files[0]);
}

function fetchStudentsList() {
    const container = document.getElementById('studentsListContainer');
    if (!container) return;
    const classFilter = document.getElementById('filterStudentClass') ? document.getElementById('filterStudentClass').value : 'ALL';
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading students...</p>`;

    db.collection('users').where('role', '==', 'student').get().then(snapshot => {
        const header = document.getElementById('studentsCountHeader');
        if (header) header.innerText = `All Registered Students (${snapshot.size})`;

        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No students registered yet.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let s = doc.data();
            let assignedClass = s.assignedClass || 'None';
            if (classFilter !== 'ALL' && assignedClass !== classFilter) return;

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${s.username}</b> (${s.email})<br>
                        <span style="color: var(--text-muted); font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Phone: <b>${s.phone || 'N/A'}</b> | Track: <b>${s.examTrack || 'ALL'}</b></span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem;" title="View Profile"><i class="fa-solid fa-address-card"></i> Profile</button>
                        <button onclick="openEditProfileModalDirect('${doc.id}')" class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem; background: #2563eb;" title="Edit Profile"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button onclick="openReassignModal('${doc.id}', '${assignedClass}')" class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem; background: #d97706;" title="Assign Class"><i class="fa-solid fa-book"></i> Assign</button>
                        <button onclick="deleteStudentAccount('${doc.id}')" class="logout-btn" style="padding: 5px 10px; font-size: 0.75rem;" title="Delete Student"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || `<p style="color: var(--text-muted); font-size: 0.85rem;">No students found for this filter.</p>`;
    });
}

// Helper openers for student action buttons
function openEditProfileModalDirect(userId) {
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            activeProfileId = userId;
            activeProfileData = doc.data();
            openEditProfileModal();
        }
    });
}

function openReassignModal(userId, currentClass) {
    document.getElementById('reassignUserId').value = userId;
    populateClassDropdowns();
    setTimeout(() => {
        const sel = document.getElementById('reassignClassSelect');
        if (sel) sel.value = currentClass;
    }, 200);
    document.getElementById('reassignModal').classList.remove('hidden');
}

function registerStudentByAdmin() {
    const name = document.getElementById('studentNameInput').value.trim();
    const email = document.getElementById('studentEmailInput').value.trim().toLowerCase();
    const phone = document.getElementById('studentPhoneInput').value.trim();
    const studentClass = document.getElementById('studentClassDropdownSelect').value;
    const examTrack = document.getElementById('studentExamTrackSelect').value;
    const gender = document.getElementById('studentGenderSelect').value;

    if (!name || !email || !phone || !studentClass) {
        alert("Please fill in student name, email, phone number, and select class.");
        return;
    }
    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }

    db.collection('users').add({
        username: name,
        email: email,
        phone: phone,
        role: 'student',
        assignedClass: studentClass,
        examTrack: examTrack,
        gender: gender,
        isRegisteredByAdmin: true,
        createdAt: new Date()
    }).then(() => {
        alert(`Student ${name} pre-registered successfully!`);
        document.getElementById('studentNameInput').value = '';
        document.getElementById('studentEmailInput').value = '';
        document.getElementById('studentPhoneInput').value = '';
        fetchStudentsList();
        updateDashboardCounters();
    });
}

function deleteStudentAccount(docId) {
    if (confirm("Delete this student?")) {
        db.collection('users').doc(docId).delete().then(() => {
            fetchStudentsList();
            updateDashboardCounters();
        });
    }
}

function downloadStudentCSVTemplate() {
    let csvContent = "username,email,phone,assignedClass,examTrack,gender\nJane Doe,jane.doe@gmail.com,08098765432,SS 3 Gold,JAMB,Female\n";
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elsa_students_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseStudentCSV() {
    const fileInput = document.getElementById('studentCsvFileInput');
    if (!fileInput || fileInput.files.length === 0) { alert("Select CSV file first."); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return;
        const batch = db.batch();
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(c => c.trim());
            if (row.length >= 4) {
                let docRef = db.collection('users').doc();
                batch.set(docRef, {
                    username: row[0],
                    email: row[1].toLowerCase(),
                    phone: row[2] || 'N/A',
                    assignedClass: row[3] || 'None',
                    examTrack: row[4] || 'ALL',
                    gender: row[5] || 'Female',
                    role: 'student',
                    isRegisteredByAdmin: true,
                    createdAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`Uploaded ${count} students successfully!`);
            fileInput.value = '';
            fetchStudentsList();
            updateDashboardCounters();
        });
    };
    reader.readAsText(fileInput.files[0]);
}

// ==========================================
// USER PROFILE MODALS (VIEW, EDIT, PDF EXPORT)
// ==========================================
function openProfileModal(userId) {
    activeProfileId = userId;
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            let u = doc.data();
            activeProfileData = u;
            document.getElementById('profileModalTitle').innerText = `${u.teacherTitle ? u.teacherTitle + ' ' : ''}${u.username} (${(u.role || 'student').toUpperCase()})`;
            document.getElementById('profileAvatarContainer').style.display = 'flex';
            
            const passportImg = document.getElementById('profilePassportImg');
            const defaultIcon = document.getElementById('profileDefaultIcon');

            if (u.passportUrl) {
                passportImg.src = u.passportUrl;
                passportImg.style.display = 'block';
                defaultIcon.style.display = 'none';
            } else {
                passportImg.style.display = 'none';
                defaultIcon.style.display = 'block';
            }

            let trackRow = u.role === 'student' ? `<p><b>Exam Track:</b> <span>${u.examTrack || 'ALL'}</span></p>` : '';
            let titleRow = u.role === 'teacher' ? `<p><b>Title:</b> <span>${u.teacherTitle || 'Mr.'}</span></p>` : '';

            document.getElementById('profileModalBody').innerHTML = `
                ${titleRow}
                <p><b>Full Name:</b> <span>${u.username}</span></p>
                <p><b>Gmail Address:</b> <span>${u.email}</span></p>
                <p><b>Phone Number:</b> <span>${u.phone || 'N/A'}</span></p>
                <p><b>Role:</b> <span>${(u.role || 'student').toUpperCase()}</span></p>
                <p><b>Assigned Class:</b> <span>${u.assignedClass || 'None'}</span></p>
                <p><b>Gender:</b> <span>${u.gender || 'N/A'}</span></p>
                ${trackRow}
            `;
            document.getElementById('profileModal').classList.remove('hidden');
        }
    });
}
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }

function openEditProfileModal() {
    if (!activeProfileData || !activeProfileId) return;
    closeProfileModal();
    populateClassDropdowns();
    document.getElementById('editUserId').value = activeProfileId;
    document.getElementById('editUserRole').value = activeProfileData.role || 'student';
    document.getElementById('editProfileName').value = activeProfileData.username || '';
    document.getElementById('editProfileEmail').value = activeProfileData.email || '';
    document.getElementById('editProfileGender').value = activeProfileData.gender || 'Male';
    document.getElementById('editProfileTrack').value = activeProfileData.examTrack || 'ALL';
    document.getElementById('editTeacherTitle').value = activeProfileData.teacherTitle || 'Mr.';

    document.getElementById('editTeacherTitleGroup').style.display = activeProfileData.role === 'teacher' ? 'flex' : 'none';
    document.getElementById('editProfileTrackGroup').style.display = activeProfileData.role === 'student' ? 'flex' : 'none';

    setTimeout(() => {
        document.getElementById('editProfileClass').value = activeProfileData.assignedClass || 'None';
    }, 300);

    document.getElementById('editProfileModal').classList.remove('hidden');
}

function closeEditProfileModal() { document.getElementById('editProfileModal').classList.add('hidden'); }

function saveProfileEdits() {
    const uid = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;
    const name = document.getElementById('editProfileName').value.trim();
    const email = document.getElementById('editProfileEmail').value.trim().toLowerCase();
    const gender = document.getElementById('editProfileGender').value;
    const assignedClass = document.getElementById('editProfileClass').value;

    let updateData = { username: name, email: email, gender: gender, assignedClass: assignedClass };
    if (role === 'teacher') updateData.teacherTitle = document.getElementById('editTeacherTitle').value;
    if (role === 'student') updateData.examTrack = document.getElementById('editProfileTrack').value;

    db.collection('users').doc(uid).update(updateData).then(() => {
        alert("Profile updated successfully!");
        closeEditProfileModal();
        fetchAllUsersList('ALL');
        fetchTeachersList();
        fetchStudentsList();
    });
}

function closeReassignModal() {
    const modal = document.getElementById('reassignModal');
    if (modal) modal.classList.add('hidden');
}

function saveUserReassignment() {
    const uid = document.getElementById('reassignUserId').value;
    const targetClass = document.getElementById('reassignClassSelect').value;
    db.collection('users').doc(uid).update({ assignedClass: targetClass }).then(() => {
        alert("Class assignment updated!");
        closeReassignModal();
        fetchAllUsersList('ALL');
    });
}

// ==========================================
// QUESTION BANK MANAGEMENT (PUBLISH, EDIT, UNPUBLISH, VIEW)
// ==========================================
let tempQuestionImageBase64 = "";
function convertQuestionImageToBase64(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            tempQuestionImageBase64 = e.target.result;
            document.getElementById('singleImageUrl').value = tempQuestionImageBase64;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveSingleQuestion() {
    const editId = document.getElementById('editQuestionId').value;
    const examType = document.getElementById('singleExamType').value;
    const subject = document.getElementById('singleSubject').value;
    const year = document.getElementById('singleYear').value.trim() || "2026";
    const questionText = document.getElementById('singleQuestionText').value.trim();
    const imageUrl = document.getElementById('singleImageUrl').value.trim();
    const optA = document.getElementById('singleOptA').value.trim();
    const optB = document.getElementById('singleOptB').value.trim();
    const optC = document.getElementById('singleOptC').value.trim();
    const optD = document.getElementById('singleOptD').value.trim();
    const correct = document.getElementById('singleCorrect').value;
    const explanation = document.getElementById('singleExplanation').value.trim();

    if (!subject || !questionText || !optA || !optB || !optC || !optD) {
        alert("Please fill in all required question fields.");
        return;
    }

    const questionId = editId ? editId : `${examType}_${subject.substring(0,3).toUpperCase()}_${Date.now()}`;

    db.collection('questions').doc(questionId).set({
        questionId: questionId,
        examType: examType,
        subject: subject,
        year: year,
        questionText: questionText,
        imageUrl: imageUrl,
        options: { A: optA, B: optB, C: optC, D: optD },
        correctOption: correct,
        explanation: explanation || "No explanation provided.",
        isPublished: true,
        uploadedAt: new Date()
    }, { merge: true }).then(() => {
        alert(editId ? "Question updated successfully!" : "Question saved successfully!");
        resetQuestionForm();
        fetchQuestionsForManagement(currentManagedTrack);
        updateDashboardCounters();
    });
}

function editQuestion(docId) {
    db.collection('questions').doc(docId).get().then(doc => {
        if (doc.exists) {
            let q = doc.data();
            document.getElementById('editQuestionId').value = doc.id;
            document.getElementById('singleExamType').value = q.examType || 'JAMB';
            document.getElementById('singleSubject').value = q.subject || '';
            document.getElementById('singleYear').value = q.year || '2026';
            document.getElementById('singleQuestionText').value = q.questionText || '';
            document.getElementById('singleImageUrl').value = q.imageUrl || '';
            document.getElementById('singleOptA').value = q.options?.A || '';
            document.getElementById('singleOptB').value = q.options?.B || '';
            document.getElementById('singleOptC').value = q.options?.C || '';
            document.getElementById('singleOptD').value = q.options?.D || '';
            document.getElementById('singleCorrect').value = q.correctOption || 'A';
            document.getElementById('singleExplanation').value = q.explanation || '';

            document.getElementById('saveQuestionBtn').innerText = "Update Question";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
            document.getElementById('adminPanelQuestions').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

function togglePublishStatus(docId, currentStatus) {
    db.collection('questions').doc(docId).update({
        isPublished: !currentStatus
    }).then(() => {
        fetchQuestionsForManagement(currentManagedTrack);
    }).catch(err => alert("Status update failed: " + err.message));
}

function viewFullQuestion(docId) {
    db.collection('questions').doc(docId).get().then(doc => {
        if (doc.exists) {
            let q = doc.data();
            let imgHtml = q.imageUrl ? `<img src="${q.imageUrl}" style="max-width:100%; max-height:200px; border-radius:6px; margin-top:8px;">` : '';
            const modalBody = document.getElementById('modalQuestionContent');
            if (modalBody) {
                modalBody.innerHTML = `
                    <p><b>Exam Track:</b> ${q.examType} | <b>Subject:</b> ${q.subject} | <b>Year:</b> ${q.year || '2026'}</p>
                    <p style="font-weight:bold; margin-top:8px;">${q.questionText}</p>
                    ${imgHtml}
                    <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
                        <span><b>A.</b> ${q.options?.A}</span>
                        <span><b>B.</b> ${q.options?.B}</span>
                        <span><b>C.</b> ${q.options?.C}</span>
                        <span><b>D.</b> ${q.options?.D}</span>
                    </div>
                    <p style="color:var(--naija-green); font-weight:bold; margin-top:8px;">Correct Answer: ${q.correctOption}</p>
                    <p style="background:var(--bg-gray); padding:8px; border-radius:6px;"><b>Explanation:</b> ${q.explanation || 'No explanation provided.'}</p>
                `;
                document.getElementById('questionViewModal').classList.remove('hidden');
            }
        }
    });
}

function closeQuestionModal() {
    const modal = document.getElementById('questionViewModal');
    if (modal) modal.classList.add('hidden');
}

function resetQuestionForm() {
    document.getElementById('editQuestionId').value = '';
    document.getElementById('singleQuestionText').value = '';
    document.getElementById('singleImageUrl').value = '';
    document.getElementById('singleOptA').value = '';
    document.getElementById('singleOptB').value = '';
    document.getElementById('singleOptC').value = '';
    document.getElementById('singleOptD').value = '';
    document.getElementById('singleExplanation').value = '';
    document.getElementById('singleImageFileInput').value = '';
    tempQuestionImageBase64 = "";
    document.getElementById('saveQuestionBtn').innerText = "Save Question to Database";
    document.getElementById('cancelEditBtn').classList.add('hidden');
}

function toggleFullscreenQuestionBank() {
    const el = document.getElementById('qBankInspectorWrapper');
    if (el) el.classList.toggle('fullscreen-mode');
}

function fetchQuestionsForManagement(examType) {
    currentManagedTrack = examType;
    ['JAMB', 'WAEC', 'NECO'].forEach(t => {
        const btn = document.getElementById(`btnManage${t}`);
        if (btn) btn.className = t === examType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    const delInput = document.getElementById('deleteConfirmationInput');
    if (delInput) {
        delInput.value = '';
        delInput.placeholder = `Type 'DELETE ${examType}' to unlock`;
    }
    const delHeader = document.getElementById('dangerZoneHeaderTitle');
    if (delHeader) delHeader.innerText = `Danger Zone: Delete Entire ${examType} Track`;
    const delBtn = document.getElementById('dangerDeleteBtn');
    if (delBtn) {
        delBtn.disabled = true;
        delBtn.style.background = "#9ca3af";
        delBtn.style.cursor = "not-allowed";
        delBtn.innerText = `Delete All ${examType} Questions`;
    }

    const listEl = document.getElementById('questionBankList');
    if (!listEl) return;
    listEl.innerHTML = `<p class="muted-text">Loading ${examType} questions...</p>`;

    db.collection('questions').where('examType', '==', examType).get().then(snapshot => {
        rawQuestionBankData = [];
        snapshot.forEach(doc => {
            rawQuestionBankData.push({ id: doc.id, ...doc.data() });
        });

        rawQuestionBankData.sort((a, b) => {
            if (a.subject < b.subject) return -1;
            if (a.subject > b.subject) return 1;
            return (b.year || 0) - (a.year || 0);
        });

        renderQuestionBankList(rawQuestionBankData);
    });
}

function renderQuestionBankList(questions) {
    const listEl = document.getElementById('questionBankList');
    if (!listEl) return;

    if (questions.length === 0) {
        listEl.innerHTML = `<p class="muted-text">No matching questions stored.</p>`;
        return;
    }

    let html = `<p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 8px;">Total Listed Questions: ${questions.length}</p>`;
    questions.forEach((q, idx) => {
        const isPub = q.isPublished !== false;
        html += `
            <div style="background: var(--card-bg); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-color); font-size: 0.8rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                    <div>
                        <b>#${idx + 1} [${q.subject}]</b> Year: ${q.year || '2026'} | Status: <span style="color: ${isPub ? 'var(--naija-green)' : '#d97706'}; font-weight: bold;">${isPub ? 'Published' : 'Unpublished'}</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="viewFullQuestion('${q.id}')" style="background: #4b5563; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="View Full Question"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="togglePublishStatus('${q.id}', ${isPub})" style="background: ${isPub ? '#d97706' : 'var(--naija-green)'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="${isPub ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-check'}"></i></button>
                        <button onclick="editQuestion('${q.id}')" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Edit Question"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteSingleQuestion('${q.id}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p style="color: var(--text-color);">${q.questionText}</p>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

function applyQuestionBankFilters() {
    const searchText = (document.getElementById('searchQuestionBankInput')?.value || '').toLowerCase().trim();
    const filterSub = document.getElementById('filterQbSubjectSelect')?.value || '';
    const filterYear = (document.getElementById('filterQbYearInput')?.value || '').trim();

    let filtered = rawQuestionBankData.filter(q => {
        let matchText = !searchText || (q.questionText && q.questionText.toLowerCase().includes(searchText));
        let matchSub = !filterSub || q.subject === filterSub;
        let matchYear = !filterYear || String(q.year) === filterYear;
        return matchText && matchSub && matchYear;
    });

    renderQuestionBankList(filtered);
}

function checkDeleteConfirmation(input) {
    const btn = document.getElementById('dangerDeleteBtn');
    const targetText = `DELETE ${currentManagedTrack}`;
    if (btn && input.value.trim().toUpperCase() === targetText) {
        btn.disabled = false;
        btn.style.background = "#dc2626";
        btn.style.cursor = "pointer";
    } else if (btn) {
        btn.disabled = true;
        btn.style.background = "#9ca3af";
        btn.style.cursor = "not-allowed";
    }
}

function deleteSingleQuestion(docId) {
    if (confirm("Delete this question?")) {
        db.collection('questions').doc(docId).delete().then(() => {
            fetchQuestionsForManagement(currentManagedTrack);
            updateDashboardCounters();
        });
    }
}

function clearSelectedExamTrack() {
    db.collection('questions').where('examType', '==', currentManagedTrack).get().then(snapshot => {
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
    }).then(() => {
        alert(`Successfully deleted all ${currentManagedTrack} questions.`);
        fetchQuestionsForManagement(currentManagedTrack);
        updateDashboardCounters();
    });
}

function downloadCSVTemplate(examType) {
    let csvContent = "question_id,examType,subject,year,question_text,image_url,option_a,option_b,option_c,option_d,correct_option,explanation\n";
    NIGERIAN_SUBJECTS.forEach((sub) => {
        const idCode = sub.substring(0, 3).toUpperCase();
        csvContent += `${examType}_${idCode}_001,${examType},${sub},2026,"Sample ${examType} question for ${sub}.",https://example.com/diagram.png,Option A,Option B,Option C,Option D,A,"Explanation for ${sub}."\n`;
    });
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elsa_${examType.toLowerCase()}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseCSVQuestions() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || fileInput.files.length === 0) { alert("Please select a CSV file first."); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return;
        const batch = db.batch();
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
            if (row.length >= 11) {
                let qId = row[0] || `Q_${Date.now()}_${i}`;
                let docRef = db.collection('questions').doc(qId);
                batch.set(docRef, {
                    questionId: qId,
                    examType: (row[1] || "JAMB").toUpperCase().trim(),
                    subject: row[2] || "Mathematics",
                    year: row[3] || "2026",
                    questionText: row[4],
                    imageUrl: row[5] || "",
                    options: { A: row[6], B: row[7], C: row[8], D: row[9] },
                    correctOption: (row[10] || "A").toUpperCase().trim(),
                    explanation: row[11] || "No explanation provided.",
                    isPublished: true,
                    uploadedAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`🎉 Successfully uploaded ${count} questions from CSV!`);
            fileInput.value = '';
            fetchQuestionsForManagement(currentManagedTrack);
            updateDashboardCounters();
        });
    };
    reader.readAsText(fileInput.files[0]);
}

// ==========================================
// VIDEO LESSONS (EMBEDDED WATCH, PUBLISH/UNPUBLISH, ASSIGN SUBJECT)
// ==========================================
let tempVideoBase64 = "";
function convertVideoFileToBase64(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            tempVideoBase64 = e.target.result;
            document.getElementById('videoUrlInput').value = tempVideoBase64;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveAdminVideo() {
    const title = document.getElementById('videoTitleInput').value.trim();
    const subject = document.getElementById('videoSubjectSelect').value;
    const examType = document.getElementById('videoExamType').value;
    const year = document.getElementById('videoYearInput').value.trim() || "2026";
    const url = document.getElementById('videoUrlInput').value.trim();

    if (!title || !subject || !url) {
        alert("Please fill in video title, subject, and provide video URL/file.");
        return;
    }

    db.collection('videos').add({
        title: title,
        subject: subject,
        examType: examType,
        year: year,
        url: url,
        isPublished: true,
        uploadedAt: new Date()
    }).then(() => {
        alert("Video lesson added successfully!");
        document.getElementById('videoTitleInput').value = '';
        document.getElementById('videoUrlInput').value = '';
        if (document.getElementById('videoFileInput')) document.getElementById('videoFileInput').value = '';
        tempVideoBase64 = "";
        fetchAdminVideos();
    });
}

function fetchAdminVideos() {
    const container = document.getElementById('adminVideosListContainer');
    if (!container) return;
    const filterExam = document.getElementById('filterVideoExam') ? document.getElementById('filterVideoExam').value : 'ALL';
    const filterSub = document.getElementById('filterVideoSubject') ? document.getElementById('filterVideoSubject').value : '';
    const filterYear = document.getElementById('filterVideoYear') ? document.getElementById('filterVideoYear').value.trim() : '';

    container.innerHTML = `<p class="muted-text">Loading videos...</p>`;

    db.collection('videos').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="muted-text">No video lessons uploaded yet.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let v = doc.data();
            if (filterExam !== 'ALL' && v.examType && v.examType !== filterExam) return;
            if (filterSub !== '' && v.subject !== filterSub) return;
            if (filterYear !== '' && String(v.year) !== filterYear) return;

            const isPub = v.isPublished !== false;
            const embedUrl = convertYouTubeUrlToEmbed(v.url);
            const safeTitle = (v.title || '').replace(/'/g, "\\'");

            html += `
                <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 0.85rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 70px; height: 40px; background: #000; border-radius: 4px; overflow: hidden; position: relative; flex-shrink: 0; cursor: pointer;" onclick="openVideoWatchModal('${embedUrl}', '${safeTitle}')">
                            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); color: white; font-size: 0.8rem;">
                                <i class="fa-solid fa-play"></i>
                            </div>
                        </div>
                        <div>
                            <b>${v.title}</b><br>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">[${v.examType || 'ALL'} - ${v.subject}] (${v.year || '2026'}) | Status: <b style="color: ${isPub ? 'var(--naija-green)' : '#d97706'};">${isPub ? 'Published' : 'Unpublished'}</b></span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button onclick="openVideoWatchModal('${embedUrl}', '${safeTitle}')" class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem;"><i class="fa-solid fa-play"></i> Watch</button>
                        <button onclick="toggleVideoPublishStatus('${doc.id}', ${isPub})" class="primary-btn" style="background: ${isPub ? '#d97706' : 'var(--naija-green)'}; padding: 5px 10px; font-size: 0.75rem;" title="${isPub ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-check'}"></i></button>
                        <button onclick="openAssignVideoSubjectModal('${doc.id}', '${v.subject}')" class="primary-btn" style="background: #2563eb; padding: 5px 10px; font-size: 0.75rem;" title="Assign Subject"><i class="fa-solid fa-book"></i> Assign</button>
                        <button onclick="deleteAdminVideo('${doc.id}')" class="logout-btn" style="padding: 5px 10px; font-size: 0.75rem;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || `<p class="muted-text">No videos found for this filter.</p>`;
    });
}

function toggleVideoPublishStatus(docId, currentStatus) {
    db.collection('videos').doc(docId).update({ isPublished: !currentStatus }).then(() => fetchAdminVideos());
}

function reassignVideoSubject(docId, currentSub) {
    let newSub = prompt(`Enter Subject Name to assign this video to (Current: ${currentSub}):`, currentSub);
    if (newSub && newSub.trim() !== "") {
        db.collection('videos').doc(docId).update({ subject: newSub.trim() }).then(() => {
            alert(`Video assigned to ${newSub.trim()}!`);
            fetchAdminVideos();
        });
    }
}

function convertYouTubeUrlToEmbed(url) {
    if (!url) return '';
    if (url.includes('embed') || url.startsWith('data:video')) return url;
    let videoId = '';
    if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('watch?v=')) {
        videoId = url.split('watch?v=')[1]?.split('&')[0];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

function openVideoWatchModal(embedUrl, title) {
    document.getElementById('videoModalTitle').innerText = title;
    document.getElementById('videoModalFrame').src = embedUrl;
    document.getElementById('videoWatchModal').classList.remove('hidden');
}

function closeVideoWatchModal() {
    document.getElementById('videoModalFrame').src = '';
    document.getElementById('videoWatchModal').classList.add('hidden');
}

function deleteAdminVideo(docId) {
    if (confirm("Delete this video?")) {
        db.collection('videos').doc(docId).delete().then(() => fetchAdminVideos());
    }
}

function downloadVideoCSVTemplate() {
    let csvContent = "title,subject,examType,year,url\nOptics & Light Waves,Physics,JAMB,2026,https://youtube.com/watch?v=sample\n";
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elsa_videos_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseVideoCSV() {
    const fileInput = document.getElementById('videoCsvFileInput');
    if (!fileInput || fileInput.files.length === 0) { alert("Select CSV file first."); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return;
        const batch = db.batch();
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(c => c.trim());
            if (row.length >= 5) {
                let docRef = db.collection('videos').doc();
                batch.set(docRef, {
                    title: row[0],
                    subject: row[1],
                    examType: row[2] || 'ALL',
                    year: row[3] || '2026',
                    url: row[4],
                    isPublished: true,
                    uploadedAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`Uploaded ${count} videos successfully!`);
            fileInput.value = '';
            fetchAdminVideos();
        });
    };
    reader.readAsText(fileInput.files[0]);
}

// ==========================================
// STUDY HUB (SEQUENTIAL QUESTION NUMBERS + VIDEO MODAL)
// ==========================================
let studyQuestionsList = [];
let studyCurrentIndex = 0;
let studyUserAnswers = {};

function openStudyModal() {
    const modal = document.getElementById('studyModal');
    if (modal) modal.classList.remove('hidden');
    fetchStudyQuestionCount();
}
function closeStudyModal() {
    const modal = document.getElementById('studyModal');
    if (modal) modal.classList.add('hidden');
}

function switchStudyHubTab(mode) {
    const qBtn = document.getElementById('btnStudyTypeQuestions');
    const vBtn = document.getElementById('btnStudyTypeVideos');
    const qCont = document.getElementById('studyQuestionsSection');
    const vCont = document.getElementById('studyVideosSection');

    if (mode === 'questions') {
        if (qBtn) qBtn.classList.add('active');
        if (vBtn) vBtn.classList.remove('active');
        if (qCont) qCont.classList.remove('hidden');
        if (vCont) vCont.classList.add('hidden');
    } else {
        if (vBtn) vBtn.classList.add('active');
        if (qBtn) qBtn.classList.remove('active');
        if (vCont) vCont.classList.remove('hidden');
        if (qCont) qCont.classList.add('hidden');
        loadStudyVideos();
    }
}

function loadStudyVideos() {
    const container = document.getElementById('studyVideosContainer');
    if (!container) return;
    container.innerHTML = `<p class="muted-text">Loading video lessons...</p>`;

    db.collection('videos').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="muted-text">No video tutorials available.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let v = doc.data();
            if (v.isPublished === false) return;
            let embedUrl = convertYouTubeUrlToEmbed(v.url);
            const safeTitle = (v.title || '').replace(/'/g, "\\'");
            
            // Renders as a clean grid card with a thumbnail preview frame that triggers the watch modal cleanly
            html += `
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s;" onclick="openVideoWatchModal('${embedUrl}', '${safeTitle}')" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="background: #000000; width: 100%; aspect-ratio: 16/9; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                            <div style="width: 44px; height: 44px; background: var(--naija-green); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                                <i class="fa-solid fa-play"></i>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 12px; display: flex; flex-direction: column; gap: 4px; flex: 1;">
                        <span style="font-size: 0.72rem; color: var(--naija-green); font-weight: bold; text-transform: uppercase;">${v.subject} (${v.year || '2026'})</span>
                        <h4 style="font-size: 0.88rem; font-weight: bold; color: var(--text-color); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${v.title}</h4>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 10px;">${html}</div>` : `<p class="muted-text">No published video tutorials available.</p>`;
    });
}

function fetchStudyQuestionCount() {
    const examType = document.getElementById('studyExamTypeSelect').value;
    const subject = document.getElementById('studySubjectSelect').value;
    const countDisplay = document.getElementById('studyQuestionCountDisplay');
    if (!countDisplay) return;

    if (!subject) {
        countDisplay.innerText = "Please select a subject.";
        return;
    }

    let query = db.collection('questions').where('subject', '==', subject);
    if (examType !== 'ALL') query = query.where('examType', '==', examType);

    query.get().then(snapshot => {
        let publishedCount = 0;
        snapshot.forEach(doc => { if (doc.data().isPublished !== false) publishedCount++; });
        countDisplay.innerText = `📚 Available Questions in Database: ${publishedCount}`;
    });
}

function startStudySession() {
    const examType = document.getElementById('studyExamTypeSelect').value;
    const subject = document.getElementById('studySubjectSelect').value;

    if (!subject) {
        alert("Please select a subject.");
        return;
    }

    closeStudyModal();
    showView('viewStudyHub');
    const titleEl = document.getElementById('studyHubTitle');
    if (titleEl) titleEl.innerText = `📖 Study Hub: ${subject} (${examType})`;

    const container = document.getElementById('studyQuestionsContainer');
    if (!container) return;
    container.innerHTML = `<p class="muted-text">Loading study questions...</p>`;

    let query = db.collection('questions').where('subject', '==', subject);
    if (examType !== 'ALL') query = query.where('examType', '==', examType);

    query.get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="muted-text">No questions found for ${subject}.</p>`;
            return;
        }

        studyQuestionsList = [];
        snapshot.forEach(doc => {
            let data = doc.data();
            if (data.isPublished !== false) {
                studyQuestionsList.push({ id: doc.id, ...data });
            }
        });
        studyCurrentIndex = 0;
        studyUserAnswers = {};
        renderStudyHubInterface();
    });
}

function renderStudyHubInterface() {
    const container = document.getElementById('studyQuestionsContainer');
    if (!container || studyQuestionsList.length === 0) return;

    const q = studyQuestionsList[studyCurrentIndex];
    const questionNumber = studyCurrentIndex + 1;
    let imgHtml = q.imageUrl ? `<div style="margin-bottom:10px;"><img src="${q.imageUrl}" style="max-width:100%; max-height:220px; border-radius:6px;"></div>` : '';
    
    let optionsHtml = '';
    ['A', 'B', 'C', 'D'].forEach(optKey => {
        if (q.options && q.options[optKey]) {
            let isSelected = studyUserAnswers[studyCurrentIndex] === optKey;
            optionsHtml += `
                <div onclick="selectStudyOption(${studyCurrentIndex}, '${optKey}')" class="cbt-option-item ${isSelected ? 'selected' : ''}" style="cursor: pointer; padding: 8px 12px; margin-bottom: 6px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <b>${optKey}.</b> ${q.options[optKey]}
                </div>
            `;
        }
    });

    let paletteHtml = '';
    studyQuestionsList.forEach((item, idx) => {
        let status = studyUserAnswers[idx] ? 'answered' : '';
        if (idx === studyCurrentIndex) status += ' current';
        paletteHtml += `<button onclick="jumpStudyQuestion(${idx})" class="palette-num-btn ${status}" style="width: 32px; height: 32px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); cursor: pointer;">${idx + 1}</button>`;
    });

    let safeExplanation = (q.explanation || "No explanation provided.").replace(/'/g, "\\'").replace(/"/g, '&quot;');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 260px; gap: 16px; align-items: start;">
            <div class="content-box" style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 20px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span class="brand-badge" style="font-size: 0.75rem; background: var(--naija-green-light); color: var(--naija-green-dark);">${q.examType || 'GENERAL'} • ${q.subject}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Year: ${q.year || '2026'} | Question ${questionNumber} of ${studyQuestionsList.length}</span>
                </div>
                <p style="font-weight: bold; margin-bottom: 12px;">${questionNumber}. ${q.questionText}</p>
                ${imgHtml}
                <div style="margin-bottom: 14px;">${optionsHtml}</div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="navigateStudy(-1)" class="primary-btn" style="background: #4b5563; font-size: 0.8rem; padding: 6px 12px;"><i class="fa-solid fa-arrow-left"></i> Previous</button>
                    <button onclick="openExplanationModal('${q.correctOption}', '${safeExplanation}')" class="primary-btn" style="background: #2563eb; font-size: 0.8rem; padding: 6px 12px;"><i class="fa-solid fa-lightbulb"></i> Solution</button>
                    <button onclick="navigateStudy(1)" class="primary-btn" style="font-size: 0.8rem; padding: 6px 12px;">Next <i class="fa-solid fa-arrow-right"></i></button>
                </div>
            </div>
            <div style="background: var(--card-bg); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                <h4 style="font-size: 0.85rem; color: var(--naija-green); margin-bottom: 8px;">Question Palette</h4>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; max-height: 300px; overflow-y: auto;">
                    ${paletteHtml}
                </div>
            </div>
        </div>
    `;
}

function selectStudyOption(qIdx, optKey) {
    studyUserAnswers[qIdx] = optKey;
    renderStudyHubInterface();
}

function jumpStudyQuestion(idx) {
    studyCurrentIndex = idx;
    renderStudyHubInterface();
}

function navigateStudy(step) {
    let newIdx = studyCurrentIndex + step;
    if (newIdx >= 0 && newIdx < studyQuestionsList.length) {
        studyCurrentIndex = newIdx;
        renderStudyHubInterface();
    }
}

function openExplanationModal(correctOpt, explanation) {
    const body = document.getElementById('explanationModalBody');
    if (body) {
        body.innerHTML = `
            <p style="font-weight: bold; color: var(--naija-green); margin-bottom: 8px;">Correct Answer: ${correctOpt}</p>
            <p style="font-size: 0.9rem;">${explanation}</p>
        `;
    }
    const modal = document.getElementById('explanationModal');
    if (modal) modal.classList.remove('hidden');
}

function closeExplanationModal() {
    const modal = document.getElementById('explanationModal');
    if (modal) modal.classList.add('hidden');
}

// ==========================================
// AUTHENTICATION & LOGOUT
// ==========================================
function handleLogout() { 
    if (inactivityLogoutTimer) clearTimeout(inactivityLogoutTimer);
    if (presenceInterval) clearInterval(presenceInterval);
    if (auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).update({ isOnline: false, lastActive: new Date(0) }).catch(() => {});
    }
    auth.signOut().then(() => showLoggedOutUI()); 
}

function showLoggedOutUI() {
    document.getElementById('userStatusBadge').innerText = "Not Logged In";
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('hamburgerBtn').classList.add('hidden');
    document.getElementById('appSidebar').classList.add('hidden');
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('authSection').classList.remove('hidden');
    switchAuthTab('login');
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;

    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please enter a valid @gmail.com address.");
        return;
    }

    auth.signInWithEmailAndPassword(email, pass)
        .catch((err) => {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                db.collection('users').where('email', '==', email).get().then(snapshot => {
                    if (!snapshot.empty) {
                        let existingDoc = snapshot.docs[0];
                        let existingData = existingDoc.data();
                        auth.createUserWithEmailAndPassword(email, pass)
                            .then((cred) => {
                                return db.collection('users').doc(cred.user.uid).set({
                                    ...existingData,
                                    createdAt: existingData.createdAt || new Date()
                                }, { merge: true });
                            })
                            .then(() => {
                                alert("🎉 Account activated and logged in successfully!");
                            })
                            .catch(createErr => {
                                alert("Login Error: " + createErr.message);
                            });
                    } else {
                        alert("Login Error: " + err.message);
                    }
                });
            } else {
                alert("Login Error: " + err.message);
            }
        });
}

function handleSignupSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const pass = document.getElementById('signupPassword').value;
    const username = document.getElementById('signupUsername').value.trim();
    const role = document.getElementById('signupRole').value;
    const gender = document.getElementById('signupGender').value;
    const teacherTitle = document.getElementById('signupTeacherTitle')?.value || '';
    const passportInput = document.getElementById('signupPassportInput');

    if (role === 'admin' && !PERMITTED_ADMINS.includes(email)) { 
        alert("Access Denied: Unauthorized admin email."); 
        return; 
    }

    db.collection('users').where('email', '==', email).get().then(snap => {
        if (snap.empty && !PERMITTED_ADMINS.includes(email)) {
            alert("❌ Signup Denied: Your Gmail address must be pre-registered by an administrator first.");
            openContactAdminModal();
            return;
        }

        let preRegDocId = null;
        let existingData = {};
        if (!snap.empty) {
            preRegDocId = snap.docs[0].id;
            existingData = snap.docs[0].data();
        }
        
        const finishSignup = (passportUrl = "") => {
            auth.createUserWithEmailAndPassword(email, pass).then(cred => {
                const newUid = cred.user.uid;
                const batch = db.batch();
                
                const newDocRef = db.collection('users').doc(newUid);
                batch.set(newDocRef, {
                    username: username || existingData.username,
                    email,
                    role,
                    gender,
                    teacherTitle: role === 'teacher' ? teacherTitle : (existingData.teacherTitle || ''),
                    assignedClass: existingData.assignedClass || 'Unassigned',
                    examTrack: existingData.examTrack || 'ALL',
                    passportUrl: passportUrl || existingData.passportUrl || "",
                    createdAt: existingData.createdAt || new Date()
                }, { merge: true });

                if (preRegDocId && preRegDocId !== newUid) {
                    batch.delete(db.collection('users').doc(preRegDocId));
                }

                return batch.commit();
            }).then(() => {
                alert("🎉 Account registered and linked successfully!");
            }).catch(err => {
                console.error("Signup Firebase Error:", err);
                alert("Signup error: " + err.message);
            });
        };

        if (passportInput && passportInput.files.length > 0) {
            let reader = new FileReader();
            reader.onload = ev => finishSignup(ev.target.result);
            reader.onerror = () => { alert("Error reading passport image file."); };
            reader.readAsDataURL(passportInput.files[0]);
        } else {
            finishSignup();
        }
    }).catch(err => {
        console.error("Firestore pre-reg lookup error:", err);
        alert("Database connection error during signup check: " + err.message);
    });
}

function downloadProfilePDF() {
    const element = document.getElementById('pdfProfileContent');
    if (!element) return;
    const opt = {
        margin:       10,
        filename:     `ELSA_Profile_${activeProfileData ? activeProfileData.username : 'Slip'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
}

// Select-Type Subject Assignment Functions (Replaces alert/prompt typing)
function openAssignVideoSubjectModal(docId, currentSubject) {
    document.getElementById('assignVideoDocId').value = docId;
    const dropdown = document.getElementById('assignVideoSubjectDropdown');
    if (dropdown) dropdown.value = currentSubject || "";
    document.getElementById('assignVideoSubjectModal').classList.remove('hidden');
}

function closeAssignVideoSubjectModal() {
    document.getElementById('assignVideoSubjectModal').classList.add('hidden');
}

function confirmAssignVideoSubject() {
    const docId = document.getElementById('assignVideoDocId').value;
    const newSubject = document.getElementById('assignVideoSubjectDropdown').value;
    if (!newSubject) { alert("Please select a subject from the dropdown."); return; }
    db.collection('videos').doc(docId).update({ subject: newSubject }).then(() => {
        alert(`✅ Video assigned to ${newSubject}!`);
        closeAssignVideoSubjectModal();
        fetchAdminVideos();
    });
}

// Fix missing fetchLeaderboard error on login
function fetchLeaderboard() {
    // Leaderboard logic or placeholder to prevent console errors
    console.log("Leaderboard initialized.");
}

// Interactive CBT Screen Corrections Review Handler
function openInteractiveCbtCorrection() {
    if (!currentExamQuestions || currentExamQuestions.length === 0) {
        alert("No active session questions found to review interactively.");
        return;
    }
    document.getElementById('standaloneResultsWindow').classList.add('hidden');
    document.getElementById('standaloneCbtWindow').classList.remove('hidden');
    document.getElementById('cbtReviewModeTag').classList.remove('hidden');
    document.getElementById('cbtReviewExplanationBox').classList.remove('hidden');
    
    // Switch UI to correction review display mode for the first question
    currentQuestionIndex = 0;
    displayCurrentQuestionForReview();
}

// Review mode specific display that shows explanations per question
function displayCurrentQuestionForReview() {
    if (currentExamQuestions.length === 0) return;
    const q = currentExamQuestions[currentQuestionIndex];
    const itemLog = currentExamQuestions[currentQuestionIndex];

    document.getElementById('cbtQuestionNumberLabel').innerText = `Review Question ${currentQuestionIndex + 1} of ${currentExamQuestions.length}`;
    document.getElementById('cbtSubjectTitle').innerText = q.subject;
    document.getElementById('cleanMetaText').innerText = `Review Mode • Track: ${q.examType || currentSelectedExamType}`;

    document.querySelectorAll('.cbt-subject-tab').forEach(tabBtn => {
        tabBtn.classList.toggle('active', tabBtn.innerText.trim() === q.subject);
    });

    let imgHtml = q.imageUrl ? `<div style="margin-bottom:12px;"><img src="${q.imageUrl}" style="max-width:100%; max-height:220px; border-radius:6px; border:1px solid var(--border-color);"></div>` : '';
    document.getElementById('cbtQuestionBodyText').innerHTML = `
        <p style="margin-bottom: 12px; font-weight: 600;">${q.questionText}</p>
        ${imgHtml}
    `;

    const optionsContainer = document.getElementById('cbtOptionsContainer');
    optionsContainer.innerHTML = '';
    ['A', 'B', 'C', 'D'].forEach(optKey => {
        if (q.options && q.options[optKey]) {
            let userPick = userAnswers[q.id];
            let bg = 'var(--bg-gray)';
            let color = 'var(--text-color)';
            if (optKey === q.correctOption) {
                bg = 'rgba(0, 135, 81, 0.2)';
                color = '#008751';
            } else if (optKey === userPick && userPick !== q.correctOption) {
                bg = 'rgba(220, 38, 38, 0.2)';
                color = '#dc2626';
            }
            optionsContainer.innerHTML += `
                <div class="cbt-option-item" style="background: ${bg}; color: ${color};">
                    <b>${optKey}.</b> ${q.options[optKey]} ${optKey === q.correctOption ? '<b>(Correct Answer)</b>' : ''}
                </div>
            `;
        }
    });

    const expText = document.getElementById('cbtReviewExplanationText');
    if (expText) expText.innerText = q.explanation || "No explanation provided.";
    renderQuestionPalette();
}

// Teacher Portal Quick Roster Loader
function fetchTeacherPortalData(assignedClass) {
    if (!assignedClass || assignedClass === 'None') return;
    db.collection('users').where('assignedClass', '==', assignedClass).where('role', '==', 'student').get().then(snapshot => {
        console.log(`Loaded ${snapshot.size} students for teacher's class: ${assignedClass}`);
    });
}

let activePlayingVideoUrl = "";
let activePlayingVideoTitle = "";

function openVideoWatchModal(embedUrl, title) {
    activePlayingVideoUrl = embedUrl;
    activePlayingVideoTitle = title;
    document.getElementById('videoModalTitle').innerText = title;
    const iframe = document.getElementById('videoModalFrame');
    const nativeVideo = document.getElementById('videoModalNative');

    if (embedUrl.startsWith('data:video') || embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm')) {
        iframe.style.display = 'none';
        nativeVideo.style.display = 'block';
        nativeVideo.src = embedUrl;
        nativeVideo.play();
    } else {
        nativeVideo.style.display = 'none';
        iframe.style.display = 'block';
        nativeVideo.src = '';
        iframe.src = embedUrl;
    }

    document.getElementById('videoWatchModal').classList.remove('hidden');
    document.getElementById('floatingVideoContainer').classList.remove('active');
}

function dockVideoToFloatingPlayer() {
    closeVideoWatchModal();
    document.getElementById('floatingVideoTitle').innerText = activePlayingVideoTitle;
    document.getElementById('floatingVideoFrame').src = activePlayingVideoUrl;
    document.getElementById('floatingVideoContainer').classList.add('active');
}

function closeFloatingVideo() {
    document.getElementById('floatingVideoFrame').src = '';
    document.getElementById('floatingVideoContainer').classList.remove('active');
}

function expandFloatingVideo() {
    openVideoWatchModal(activePlayingVideoUrl, activePlayingVideoTitle);
    closeFloatingVideo();
}