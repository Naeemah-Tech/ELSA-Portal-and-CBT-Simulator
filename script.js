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
        iconEl.className = 'fa-solid fa-eye-slash toggle-password-icon';
    } else {
        input.type = 'password';
        iconEl.className = 'fa-solid fa-eye toggle-password-icon';
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
            overlay.classList.remove('hidden');
        } else {
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

function routeUserDashboard(uid) {
    db.collection('users').doc(uid).get().then((doc) => {
        let username = "User";
        let role = "student";

        if (doc.exists) {
            const data = doc.data();
            username = data.username || "User";
            role = data.role || "student";
        }

        document.getElementById('userStatusBadge').innerText = `${username} (${role.toUpperCase()})`;
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('hamburgerBtn').classList.remove('hidden');
        document.getElementById('welcomeUserName').innerText = username;

        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSidebar').classList.remove('hidden');

        const roleMenu = document.getElementById('roleSpecificMenu');
        if (roleMenu) {
            roleMenu.style.display = (role === 'admin' || role === 'teacher') ? 'block' : 'none';
        }

        updateDashboardCounters();
        fetchAllUsersList('ALL');
        showView('viewHome');
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
    document.getElementById(viewId).classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active-simulator'));
    if (viewId === 'viewHome') document.getElementById('navHome').classList.add('active-simulator');
    if (viewId === 'viewHistory') document.getElementById('navHistory').classList.add('active-simulator');
    if (viewId === 'viewAdmin') {
        document.getElementById('navAdmin').classList.add('active-simulator');
        switchAdminTab('classes');
    }
}

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
              if (doc.data().subject) subsSet.add(doc.data().subject);
          });
          availableExamSubjects = Array.from(subsSet).sort();
      });
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
    if(pBtn && fBtn) {
        if (mins === 40) {
            pBtn.className = "mode-box active-mode";
            fBtn.className = "mode-box";
        } else {
            fBtn.className = "mode-box active-mode";
            pBtn.className = "mode-box";
        }
    }
}

function checkProceedExamButton() {
    const pickers = document.querySelectorAll('.subject-picker');
    const proceedBtn = document.getElementById('proceedExamBtn');
    let allSelected = true;

    if (pickers.length === 0) {
        allSelected = false;
    } else {
        pickers.forEach(p => {
            if (!p.value || p.value === "") allSelected = false;
        });
    }

    if (proceedBtn) {
        if (allSelected) {
            proceedBtn.disabled = false;
            proceedBtn.classList.remove('muted-btn');
            proceedBtn.style.opacity = '1';
            proceedBtn.style.cursor = 'pointer';
        } else {
            proceedBtn.disabled = true;
            proceedBtn.classList.add('muted-btn');
            proceedBtn.style.opacity = '0.5';
            proceedBtn.style.cursor = 'not-allowed';
        }
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
            if(sel.value) {
                let cnt = (chosenDurationMinutes === 40 ? 10 : 40);
                selectedSubjects.push({ subject: sel.value, count: cnt, startIdx: currentOffset });
                currentOffset += cnt;
            }
        });
    } else {
        let currentOffset = 0;
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if(sel.value) {
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
              alert(`No questions found in database for ${currentSelectedExamType}!`);
              closeStandaloneCbtWindow();
              return;
          }

          let allDbQuestions = [];
          snapshot.forEach((doc) => {
              allDbQuestions.push({ id: doc.id, ...doc.data() });
          });

          let assembledPaper = [];
          selectedSubjects.forEach(subObj => {
              let subPool = allDbQuestions.filter(q => q.subject === subObj.subject);
              subPool = shuffleArray(subPool);
              let sliced = subPool.slice(0, subObj.count);
              
              while(sliced.length < subObj.count && subPool.length > 0) {
                  let extra = subPool[Math.floor(Math.random() * subPool.length)];
                  sliced.push({ ...extra, id: extra.id + '_' + Math.random() });
              }
              assembledPaper = assembledPaper.concat(sliced);
          });

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
        if (tabBtn.innerText.trim() === q.subject) {
            tabBtn.classList.add('active');
        } else {
            tabBtn.classList.remove('active');
        }
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
        if (flaggedQuestions[q.id]) {
            flagBtn.classList.add('flagged');
            flagBtn.innerHTML = `<i class="fa-solid fa-flag"></i> Flagged`;
        } else {
            flagBtn.classList.remove('flagged');
            flagBtn.innerHTML = `<i class="fa-solid fa-flag"></i> Flag Question`;
        }
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
    if (screen) {
        if (screen.value === '0' && val !== '.') screen.value = val;
        else screen.value += val;
    }
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

function submitExamManually() {
    clearInterval(timerInterval);
    isExamActive = false;
    document.getElementById('standaloneCbtWindow').classList.add('hidden');
    document.getElementById('standaloneResultsWindow').classList.remove('hidden');

    let totalQuestions = currentExamQuestions.length;
    let totalCorrect = 0;
    let subjectStats = {};
    let reviewHTML = '';

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

        reviewHTML += `
            <div style="padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 0.88rem; background: var(--card-bg); margin-bottom: 6px; border-radius: 6px;">
                <p style="font-weight: bold; color: ${isCorrect ? 'var(--naija-green)' : '#dc2626'}; margin-bottom: 4px;">
                    ${idx + 1}. [${q.subject}] ${q.questionText} (${isCorrect ? 'Correct ✓' : 'Incorrect ✗'})
                </p>
                <p style="margin-bottom: 4px;">Option Picked: <b style="color: ${isCorrect ? 'var(--naija-green)' : '#dc2626'};">${userChoice}</b> | Correct Option: <b style="color: var(--naija-green);">${q.correctOption}</b></p>
                <div style="background: var(--bg-gray); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; margin-top: 6px;">
                    <b style="color: var(--naija-green);"><i class="fa-solid fa-lightbulb"></i> Explanation:</b> ${q.explanation || 'No detailed explanation provided.'}
                </div>
            </div>
        `;
    });

    let percentage = Math.round((totalCorrect / (totalQuestions || 1)) * 100);
    document.getElementById('overallPercentageBadge').innerText = `${percentage}%`;
    document.getElementById('resultsTimestamp').innerText = `Completed in ${timeUsedStr} on ${new Date().toLocaleString()}`;

    let finalScaledScore = 0;
    let gradeStatusText = "";

    if (currentSelectedExamType === 'JAMB') {
        finalScaledScore = Math.round((totalCorrect / (totalQuestions || 1)) * 400);
        document.getElementById('resTotalScore').innerText = `${finalScaledScore} / 400`;
        document.getElementById('resScoreHeaderLabel').innerText = `JAMB SCORE (/400)`;
        gradeStatusText = finalScaledScore >= 200 ? "PASSED (ADMISSIBLE)" : "NEEDS IMPROVEMENT";
    } else {
        let overallGradeObj = getWaecNecoGrade(percentage);
        document.getElementById('resTotalScore').innerText = `${overallGradeObj.grade} (${percentage}%)`;
        document.getElementById('resScoreHeaderLabel').innerText = `${currentSelectedExamType} SCORE / GRADE`;
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

        let subExtraInfo = "";
        if (currentSelectedExamType !== 'JAMB') {
            let gObj = getWaecNecoGrade(subAcc);
            subExtraInfo = ` | Grade: <b>${gObj.grade} (${gObj.remark})</b>`;
        }

        breakdownHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-gray); padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 4px;">
                <span><b>${sub}</b> (${subCorrect}/${subTotal})${subExtraInfo}</span>
                <span style="font-weight: bold; color: ${subAcc >= 50 ? 'var(--naija-green)' : '#dc2626'};">${subAcc}%</span>
            </div>
        `;
    }

    document.getElementById('resWeakSubject').innerText = weakestSub === "None" ? "None" : `${weakestSub} (${lowestPercentage}%)`;
    document.getElementById('resSubjectBreakdownList').innerHTML = breakdownHTML;
    document.getElementById('resDetailedReviewList').innerHTML = reviewHTML;

    saveExamResultToFirestore(currentSelectedExamType, percentage, totalCorrect, totalQuestions, finalScaledScore, subjectStats, timeUsedStr);
}

function closeStandaloneResultsWindow() {
    document.getElementById('standaloneResultsWindow').classList.add('hidden');
    showView('viewHome');
}

function saveExamResultToFirestore(examType, percentage, score, total, scaledScore, subjectStats, timeUsedStr) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    db.collection('exam_results').add({
        userId: uid,
        examType: examType,
        percentage: percentage,
        score: score,
        total: total,
        scaledScore: scaledScore,
        subjectStats: subjectStats,
        timeUsed: timeUsedStr,
        timestamp: new Date()
    });
}

function showExamHistoryView() {
    showView('viewHistory');
    const container = document.getElementById('examHistoryListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted);">Loading exam records & student history...</p>`;

    if (!auth.currentUser) return;
    const currentUid = auth.currentUser.uid;

    db.collection('exam_results').where('userId', '==', currentUid).orderBy('timestamp', 'desc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted);">No exam records logged yet.</p>`;
            return;
        }

        let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;

        snapshot.forEach(doc => {
            let res = doc.data();
            let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Recent';
            let formattedScore = res.examType === 'JAMB' ? `${res.scaledScore} / 400` : `${getWaecNecoGrade(res.percentage).grade} (${res.percentage}%)`;

            html += `
                <div style="background: var(--card-bg); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <b>${res.examType} Exam Session</b> • Score: <b style="color: var(--naija-green);">${formattedScore}</b><br>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Completed in ${res.timeUsed || 'N/A'} on ${dateStr}</span>
                    </div>
                    <button onclick="inspectPastExamSlip('${doc.id}')" class="primary-btn" style="padding: 4px 10px; font-size: 0.8rem;"><i class="fa-solid fa-eye"></i> View Slip</button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    });
}

function inspectPastExamSlip(resId) {
    db.collection('exam_results').doc(resId).get().then(doc => {
        if (doc.exists) {
            let res = doc.data();
            document.getElementById('overallPercentageBadge').innerText = `${res.percentage}%`;
            document.getElementById('resultsTimestamp').innerText = `Logged on ${res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Past Session'}`;
            
            if (res.examType === 'JAMB') {
                document.getElementById('resTotalScore').innerText = `${res.scaledScore} / 400`;
                document.getElementById('resScoreHeaderLabel').innerText = `JAMB SCORE (/400)`;
                document.getElementById('resGradeStatus').innerText = res.scaledScore >= 200 ? "PASSED (ADMISSIBLE)" : "NEEDS IMPROVEMENT";
            } else {
                let gObj = getWaecNecoGrade(res.percentage);
                document.getElementById('resTotalScore').innerText = `${gObj.grade} (${res.percentage}%)`;
                document.getElementById('resScoreHeaderLabel').innerText = `${res.examType} SCORE / GRADE`;
                document.getElementById('resGradeStatus').innerText = `${gObj.grade} - ${gObj.remark}`;
            }
            
            document.getElementById('standaloneResultsWindow').classList.remove('hidden');
        }
    });
}

function switchAdminTab(tab) {
    const panels = ['Classes', 'Teachers', 'Students', 'Questions', 'Videos', 'Results'];
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
    if (tab === 'videos') fetchAdminVideos();
    if (tab === 'results') { populateClassDropdowns(); fetchAdminResultsLog(); }
}

function fetchAllUsersList(filterType) {
    const container = document.getElementById('allUsersListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading user directory...</p>`;

    ['All', 'Active', 'Inactive'].forEach(f => {
        const btn = document.getElementById(`userFilter${f}Btn`);
        if (btn) btn.className = f.toLowerCase() === filterType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    db.collection('users').orderBy('username', 'asc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No users registered.</p>`;
            return;
        }

        let html = '';
        let count = 0;

        snapshot.forEach(doc => {
            let u = doc.data();
            let isActive = u.isRegisteredByAdmin || u.role === 'admin';
            
            if (filterType === 'active' && !isActive) return;
            if (filterType === 'inactive' && isActive) return;

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
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Role: <b>${u.role.toUpperCase()}</b> | Class: <b>${u.assignedClass || 'None'}</b> | Phone: <b>${u.phone || 'N/A'}</b></span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${isActive ? 'var(--naija-green-light)' : '#fee2e2'}; color: ${isActive ? 'var(--naija-green-dark)' : '#dc2626'}; font-weight: bold;">
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-address-card"></i> View Profile</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = count > 0 ? html : `<p style="color: var(--text-muted); font-size: 0.85rem;">No users match this filter.</p>`;
    });
}

function fetchAdminResultsLog() {
    const container = document.getElementById('adminResultsLog');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading student results log...</p>`;

    db.collection('exam_results').orderBy('timestamp', 'desc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No student scores recorded yet.</p>`;
            return;
        }

        let html = `<div style="display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;">`;
        snapshot.forEach(doc => {
            let res = doc.data();
            let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Recent';
            let formattedScore = res.examType === 'JAMB' ? `${res.scaledScore} / 400` : `${getWaecNecoGrade(res.percentage).grade} (${res.percentage}%)`;

            html += `
                <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <b>${res.examType} Exam Session Log</b><br>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Score: <b>${formattedScore}</b> | Time: ${res.timeUsed || 'N/A'} | Logged: ${dateStr}</span>
                    </div>
                    <button onclick="inspectPastExamSlip('${doc.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-eye"></i> View Slip</button>
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

    db.collection('classes').orderBy('createdAt', 'desc').get().then(snapshot => {
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
    db.collection('classes').orderBy('createdAt', 'desc').get().then(snapshot => {
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
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${s.username}</b> (${s.email})<br>
                        <span style="color: var(--text-muted); font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Phone: <b>${s.phone || 'N/A'}</b> | Track: <b>${s.examTrack || 'ALL'}</b></span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;">Profile</button>
                        <button onclick="deleteStudentAccount('${doc.id}')" class="logout-btn" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || `<p style="color: var(--text-muted); font-size: 0.85rem;">No students found for this filter.</p>`;
    });
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

function openProfileModal(userId) {
    activeProfileId = userId;
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            let u = doc.data();
            activeProfileData = u;
            document.getElementById('profileModalTitle').innerText = `${u.teacherTitle ? u.teacherTitle + ' ' : ''}${u.username} (${u.role.toUpperCase()})`;
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
                <p><b>Role:</b> <span>${u.role.toUpperCase()}</span></p>
                <p><b>Assigned Class:</b> <span>${u.assignedClass || 'None'}</span></p>
                <p><b>Gender:</b> <span>${u.gender || 'N/A'}</span></p>
                ${trackRow}
            `;
            document.getElementById('profileModal').classList.remove('hidden');
        }
    });
}
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }

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
        alert("Question saved successfully!");
        resetQuestionForm();
        fetchQuestionsForManagement(currentManagedTrack);
        updateDashboardCounters();
    });
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
    document.getElementById('saveQuestionBtn').innerText = "Save Question to Firestore";
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
        if(btn) btn.className = t === examType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    const delInput = document.getElementById('deleteConfirmationInput');
    if(delInput) {
        delInput.value = '';
        delInput.placeholder = `Type 'DELETE ${examType}' to unlock`;
    }
    const delHeader = document.getElementById('dangerZoneHeaderTitle');
    if(delHeader) delHeader.innerText = `Danger Zone: Delete Entire ${examType} Track`;
    const delBtn = document.getElementById('dangerDeleteBtn');
    if(delBtn) {
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
    questions.forEach(q => {
        const isPub = q.isPublished !== false;
        html += `
            <div style="background: var(--card-bg); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-color); font-size: 0.8rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                    <div>
                        <b>[${q.subject}]</b> Year: ${q.year || '2026'} | Status: <span style="color: ${isPub ? 'var(--naija-green)' : '#d97706'}; font-weight: bold;">${isPub ? 'Published' : 'Unpublished'}</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="viewFullQuestion('${q.id}')" style="background: #4b5563; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="togglePublishStatus('${q.id}', ${isPub})" style="background: ${isPub ? '#d97706' : 'var(--naija-green)'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                        <button onclick="editQuestion('${q.id}')" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="deleteSingleQuestion('${q.id}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p style="color: var(--text-color);">${q.questionText}</p>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

function applyQuestionBankFilters() {
    const searchText = (document.getElementById('searchQuestionBankInput').value || '').toLowerCase().trim();
    const filterSub = document.getElementById('filterQbSubjectSelect').value;
    const filterYear = (document.getElementById('filterQbYearInput').value || '').trim();

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
        uploadedAt: new Date()
    }).then(() => {
        alert("Video lesson added successfully!");
        document.getElementById('videoTitleInput').value = '';
        document.getElementById('videoUrlInput').value = '';
        document.getElementById('videoFileInput').value = '';
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

            html += `
                <div style="background: var(--card-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.85rem;">
                    <span><b>[${v.examType || 'ALL'} - ${v.subject}]</b> ${v.title} (${v.year || '2026'})</span>
                    <button onclick="deleteAdminVideo('${doc.id}')" class="logout-btn" style="padding: 2px 6px; font-size: 0.7rem;">Delete</button>
                </div>
            `;
        });
        container.innerHTML = html || `<p class="muted-text">No videos found for this filter.</p>`;
    });
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
            html += `
                <div class="content-box" style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px;">
                    <h4 style="color: var(--naija-green); margin-bottom: 4px;">${v.subject} (${v.year || '2026'})</h4>
                    <p style="font-weight: bold; font-size: 0.9rem; margin-bottom: 10px;">${v.title}</p>
                    <a href="${v.url}" target="_blank" class="primary-btn" style="display: inline-block; text-decoration: none; padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-play"></i> Watch Video</a>
                </div>
            `;
        });
        container.innerHTML = html;
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
        countDisplay.innerText = `📚 Available Questions in Database: ${snapshot.size}`;
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
        snapshot.forEach(doc => { studyQuestionsList.push({ id: doc.id, ...doc.data() }); });
        studyCurrentIndex = 0;
        studyUserAnswers = {};
        renderStudyHubInterface();
    });
}

function renderStudyHubInterface() {
    const container = document.getElementById('studyQuestionsContainer');
    if (!container || studyQuestionsList.length === 0) return;

    const q = studyQuestionsList[studyCurrentIndex];
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

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 260px; gap: 16px; align-items: start;">
            <div class="content-box" style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 20px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span class="brand-badge" style="font-size: 0.75rem; background: var(--naija-green-light); color: var(--naija-green-dark);">${q.examType || 'GENERAL'} • ${q.subject}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Year: ${q.year || '2026'} | Q ${studyCurrentIndex + 1} of ${studyQuestionsList.length}</span>
                </div>
                <p style="font-weight: bold; margin-bottom: 12px;">${q.questionText}</p>
                ${imgHtml}
                <div style="margin-bottom: 14px;">${optionsHtml}</div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="navigateStudy(-1)" class="primary-btn" style="background: #4b5563; font-size: 0.8rem; padding: 6px 12px;"><i class="fa-solid fa-arrow-left"></i> Previous</button>
                    <button onclick="openExplanationModal('${q.correctOption}', '${q.explanation.replace(/'/g, "\\'")}')" class="primary-btn" style="background: #2563eb; font-size: 0.8rem; padding: 6px 12px;"><i class="fa-solid fa-lightbulb"></i> Solution</button>
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

function handleLogout() { 
    if (inactivityLogoutTimer) clearTimeout(inactivityLogoutTimer);
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

// Fixed Login Submit with Auto-Activation for Pre-Registered Users
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
                            .then(() => {
                                return db.collection('users').doc(existingDoc.id).set({
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
    const password = document.getElementById('signupPassword').value;
    const username = document.getElementById('signupUsername').value.trim();
    const role = document.getElementById('signupRole').value;
    const gender = document.getElementById('signupGender').value;
    const teacherTitle = document.getElementById('signupTeacherTitle').value;
    const passportInput = document.getElementById('signupPassportInput');

    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please enter a valid @gmail.com address.");
        return;
    }

    if (role === 'admin' && !PERMITTED_ADMINS.includes(email)) {
        alert("Access Denied: Email not authorized for Admin account creation.");
        return;
    }

    db.collection('users').where('email', '==', email).get().then(snapshot => {
        if (snapshot.empty) {
            alert("❌ Signup Denied: Your Gmail address has not been pre-registered by an administrator.");
            openContactAdminModal();
            return;
        }

        let existingDocId = snapshot.docs[0].id;
        let existingData = snapshot.docs[0].data();

        if (existingData.username && existingData.username.toLowerCase() !== username.toLowerCase()) {
            alert(`❌ Signup Denied: The full name "${username}" does not match the pre-registered name on file.`);
            openContactAdminModal();
            return;
        }

        let processSignup = (passportBase64 = "") => {
            auth.createUserWithEmailAndPassword(email, password)
                .then(() => {
                    let userPayload = {
                        username: username,
                        email: email,
                        role: role,
                        assignedClass: existingData.assignedClass || 'Unassigned',
                        gender: gender,
                        passportUrl: passportBase64 || existingData.passportUrl || "",
                        createdAt: existingData.createdAt || new Date()
                    };
                    if (role === 'teacher') {
                        userPayload.teacherTitle = teacherTitle || existingData.teacherTitle || 'Mr.';
                    } else if (role === 'student') {
                        userPayload.examTrack = existingData.examTrack || 'ALL';
                    }
                    return db.collection('users').doc(existingDocId).set(userPayload, { merge: true });
                })
                .then(() => {
                    alert("🎉 Account created successfully! Welcome to ELSA CBT.");
                })
                .catch((err) => alert("Signup Failed: " + err.message));
        };

        if (passportInput && passportInput.files.length > 0) {
            let reader = new FileReader();
            reader.onload = function(uploadEvent) {
                processSignup(uploadEvent.target.result);
            };
            reader.readAsDataURL(passportInput.files[0]);
        } else {
            processSignup();
        }
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

// Update user's active status every 60 seconds while logged in
let presenceInterval = null;

function initUserPresence(uid) {
    if (!uid) return;
    
    const updatePresence = () => {
        db.collection('users').doc(uid).set({
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true
        }, { merge: true }).catch(err => console.log("Presence update error:", err));
    };

    updatePresence();
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(updatePresence, 60000); // Heartbeat every 1 min
}

// Inside your routeUserDashboard(uid) function, call:
// initUserPresence(uid);

// Update fetchAllUsersList to check if lastActive is within the last 3 minutes (active right now)
function fetchAllUsersList(filterType) {
    const container = document.getElementById('allUsersListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading user directory...</p>`;

    ['All', 'Active', 'Inactive'].forEach(f => {
        const btn = document.getElementById(`userFilter${f}Btn`);
        if (btn) btn.className = f.toLowerCase() === filterType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    db.collection('users').orderBy('username', 'asc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No users registered.</p>`;
            return;
        }

        let html = '';
        let count = 0;
        const now = new Date().getTime();

        snapshot.forEach(doc => {
            let u = doc.data();
            
            // Check if user was active in the last 3 minutes (180,000 ms)
            let lastActiveTime = u.lastActive ? u.lastActive.toDate().getTime() : 0;
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
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Role: <b>${u.role.toUpperCase()}</b> | Class: <b>${u.assignedClass || 'None'}</b></span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="status-pill ${isCurrentlyOnline ? 'online' : 'offline'}">
                            ${isCurrentlyOnline ? 'Online Now' : 'Offline'}
                        </span>
                        <button onclick="openProfileModal('${doc.id}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-address-card"></i> Profile</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = count > 0 ? html : `<p style="color: var(--text-muted); font-size: 0.85rem;">No users match this filter.</p>`;
    });
}