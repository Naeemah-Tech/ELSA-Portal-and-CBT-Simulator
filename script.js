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
let homeChartInstance = null;
let activeProfileData = null;
let activeProfileId = null;
let availableExamSubjects = [];
let examStartTime = null;

const NIGERIAN_SUBJECTS = [
    "Mathematics", "Use of English", "Physics", "Chemistry", "Biology",
    "Agricultural Science", "Economics", "Government", "Literature-in-English",
    "Christian Religious Knowledge (CRK)", "Islamic Religious Knowledge (IRK)", "Geography",
    "Financial Accounting", "Commerce", "Civic Education", "Computer Studies"
];

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('elsa_cbt_theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateThemeToggleUI(savedTheme);

    const dropdowns = document.querySelectorAll('.subject-dropdown');
    dropdowns.forEach(select => {
        select.innerHTML = '<option value="">-- Select Subject --</option>';
        NIGERIAN_SUBJECTS.forEach(sub => {
            select.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeExplanationModal();
            closeQuestionModal();
            closeStudyModal();
            closeProfileModal();
            closeEditProfileModal();
            closeReassignModal();
        }
    });
});

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

document.addEventListener("visibilitychange", function() {
    if (document.hidden && isExamActive) {
        alert("⚠️ SECURITY WARNING: Tab switching detected! Your exam has been automatically submitted.");
        submitExamManually();
    }
});

auth.onAuthStateChanged((user) => {
    if (user) {
        routeUserDashboard(user.uid);
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
        sidebar.classList.toggle('hidden');
        overlay.classList.toggle('hidden');
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
        renderHomeAnalyticsChart(uid);
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
        bannerRules.innerText = "Computer-Based Test featuring Use of English (compulsory: 60 Qs) and 3 chosen academic subjects (40 Qs each).";
        if (subjectSelectorArea) subjectSelectorArea.style.display = 'none';
        if (modesContainer) modesContainer.style.display = 'flex';
        chosenDurationMinutes = 120;
        selectTestDuration(120);
        generateJAMBSubjects();
    } else {
        bannerTitle.innerText = `${examType} Senior School Certificate Examination Simulator`;
        bannerRules.innerText = `Select your preferred subjects (50 questions per subject, 1 hour per subject).`;
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
          availableExamSubjects = Array.from(subsSet);
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
            Subject 1: Use of English (Compulsory - 60 Questions)
        </div>
    `;

    for (let i = 2; i <= 4; i++) {
        container.innerHTML += `
            <div style="margin-bottom: 8px;">
                <label class="form-label">Subject ${i} (40 Questions)</label>
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
        container.innerHTML += `
            <div style="margin-bottom: 8px;">
                <label class="form-label">Subject ${i} (50 Questions - 1 Hour)</label>
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
        selectedSubjects.push({ subject: "Use of English", count: (chosenDurationMinutes === 40 ? 20 : 60) });
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if(sel.value) selectedSubjects.push({ subject: sel.value, count: (chosenDurationMinutes === 40 ? 10 : 40) });
        });
    } else {
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if(sel.value) selectedSubjects.push({ subject: sel.value, count: 50 });
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

          currentExamQuestions = shuffleArray(assembledPaper);
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
            <button onclick="jumpToSubject('${subObj.subject}')" class="cbt-subject-tab ${idx === 0 ? 'active' : ''}">${subObj.subject}</button>
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

function jumpToSubject(subjectName) {
    const targetIdx = currentExamQuestions.findIndex(q => q.subject === subjectName);
    if (targetIdx !== -1) {
        currentQuestionIndex = targetIdx;
        displayCurrentQuestion();
    }
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

// Enlarged Calculator
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
            <div style="padding: 10px; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                <p style="font-weight: bold; color: ${isCorrect ? 'var(--naija-green)' : '#dc2626'};">
                    ${idx + 1}. [${q.subject}] ${q.questionText} (${isCorrect ? 'Correct ✓' : 'Incorrect ✗'})
                </p>
                <p style="margin-top: 2px;">Your Answer: <b>${userChoice}</b> | Correct Answer: <b style="color: var(--naija-green);">${q.correctOption}</b></p>
                <p style="font-size: 0.8rem; font-style: italic; margin-top: 4px;">💡 Explanation: ${q.explanation || 'No explanation provided.'}</p>
            </div>
        `;
    });

    let percentage = Math.round((totalCorrect / (totalQuestions || 1)) * 100);
    document.getElementById('overallPercentageBadge').innerText = `${percentage}%`;
    document.getElementById('resultsTimestamp').innerText = `Completed in ${timeUsedStr} on ${new Date().toLocaleString()}`;

    let finalScaledScore = 0;
    let gradeStatusText = "";

    if (currentSelectedExamType === 'JAMB') {
        let maxScale = (chosenDurationMinutes === 40) ? 200 : 400;
        finalScaledScore = Math.round((totalCorrect / (totalQuestions || 1)) * maxScale);
        document.getElementById('resTotalScore').innerText = `${finalScaledScore} / ${maxScale}`;
        document.getElementById('resScoreHeaderLabel').innerText = `JAMB SCORE (/${maxScale})`;
        gradeStatusText = finalScaledScore >= 200 ? "PASSED (ADMISSIBLE)" : "NEEDS IMPROVEMENT";
    } else {
        let overallGradeObj = getWaecNecoGrade(percentage);
        document.getElementById('resTotalScore').innerText = `${totalCorrect} / ${totalQuestions} (${percentage}%)`;
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
    }).then(() => {
        renderHomeAnalyticsChart(uid);
    });
}

// Grouped Exam History & Profile Viewer
function showExamHistoryView() {
    showView('viewHistory');
    const container = document.getElementById('examHistoryListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted);">Loading exam records & student history...</p>`;

    if (!auth.currentUser) return;

    db.collection('users').orderBy('username', 'asc').get().then(userSnap => {
        db.collection('exam_results').orderBy('timestamp', 'desc').get().then(resSnap => {
            let resultsMap = {};
            resSnap.forEach(doc => {
                let r = doc.data();
                if (!resultsMap[r.userId]) resultsMap[r.userId] = [];
                resultsMap[r.userId].push(r);
            });

            if (userSnap.empty) {
                container.innerHTML = `<p style="color: var(--text-muted);">No users found.</p>`;
                return;
            }

            let html = `
                <div style="margin-bottom: 16px;">
                    <h4 style="color: var(--naija-green); margin-bottom: 4px;"><i class="fa-solid fa-graduation-cap"></i> Student Examination History & Performance</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Grouped user records with exam logs, time used, and performance corrections.</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px; max-height: 550px; overflow-y: auto;">
            `;

            userSnap.forEach(doc => {
                let u = doc.data();
                let uId = doc.id;
                let userExams = resultsMap[uId] || [];
                let passportPreview = u.passportUrl 
                    ? `<img src="${u.passportUrl}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--naija-green);">` 
                    : `<div style="width: 44px; height: 44px; background: var(--naija-green-light); color: var(--naija-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;"><i class="fa-solid fa-user"></i></div>`;

                let examsListHtml = '';
                if (userExams.length === 0) {
                    examsListHtml = `<p style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">No past exam sessions recorded.</p>`;
                } else {
                    userExams.forEach(ex => {
                        let dateStr = ex.timestamp ? new Date(ex.timestamp.toDate()).toLocaleString() : 'Recent';
                        examsListHtml += `
                            <div style="background: var(--bg-gray); padding: 8px 10px; border-radius: 6px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                                <div>
                                    <b>${ex.examType}</b> • Score: <b>${ex.score} / ${ex.total} (${ex.percentage}%)</b>
                                    <br><span style="font-size: 0.7rem; color: var(--text-muted);">Time Used: ${ex.timeUsed || 'N/A'} | ${dateStr}</span>
                                </div>
                                <span style="font-weight: bold; color: ${ex.percentage >= 50 ? 'var(--naija-green)' : '#dc2626'};">${ex.percentage}%</span>
                            </div>
                        `;
                    });
                }

                html += `
                    <div style="background: var(--card-bg); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                ${passportPreview}
                                <div>
                                    <h4 style="font-size: 0.95rem; color: var(--text-color); margin-bottom: 2px;">${u.teacherTitle ? u.teacherTitle + ' ' : ''}${u.username} (${u.role.toUpperCase()})</h4>
                                    <p style="font-size: 0.75rem; color: var(--text-muted);">Class: <b>${u.assignedClass || 'None'}</b> | Email: <b>${u.email}</b> | Phone: <b>${u.phone || 'N/A'}</b></p>
                                </div>
                            </div>
                            <button onclick="openProfileModal('${uId}')" class="primary-btn" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-address-card"></i> View Full Profile</button>
                        </div>
                        <div style="border-top: 1px solid var(--border-color); padding-top: 8px;">
                            <b style="font-size: 0.8rem; color: var(--naija-green);">Exam Sessions & History (${userExams.length}):</b>
                            ${examsListHtml}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
        });
    });
}

function renderHomeAnalyticsChart(uid) {
    db.collection('exam_results')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'asc')
      .get()
      .then(snapshot => {
          let labels = [];
          let dataPoints = [];
          let count = 1;

          snapshot.forEach(doc => {
              let res = doc.data();
              labels.push(`Test ${count++} (${res.examType})`);
              dataPoints.push(res.percentage);
          });

          if (dataPoints.length === 0) {
              labels = ['No tests yet'];
              dataPoints = [0];
          }

          const canvas = document.getElementById('homeAnalyticsChart');
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (homeChartInstance) homeChartInstance.destroy();

          homeChartInstance = new Chart(ctx, {
              type: 'bar',
              data: {
                  labels: labels,
                  datasets: [{
                      label: 'Past Scores (%)',
                      data: dataPoints,
                      backgroundColor: '#008751',
                      borderRadius: 6
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                      y: { beginAtZero: true, max: 100 }
                  }
              }
          });
      });
}

// Admin Tab Switching & Management
function switchAdminTab(tab) {
    const panels = ['Classes', 'Teachers', 'Students', 'Users', 'Questions', 'Videos', 'Results'];
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
    if (tab === 'users') fetchAllUsersList('ALL');
    if (tab === 'questions') fetchQuestionsForManagement('JAMB');
    if (tab === 'videos') fetchAdminVideos();
    if (tab === 'results') { populateClassDropdowns(); fetchAdminResultsLog(); }
}

function fetchAllUsersList(filterType) {
    const container = document.getElementById('allUsersListContainer');
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading users directory...</p>`;

    db.collection('users').orderBy('username', 'asc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No users registered.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let u = doc.data();
            let isActive = u.isRegisteredByAdmin || u.role === 'admin';
            
            if (filterType === 'active' && !isActive) return;
            if (filterType === 'inactive' && isActive) return;

            html += `
                <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <b>${u.username}</b> (${u.email}) | Role: <b>${u.role.toUpperCase()}</b> | Class: <b>${u.assignedClass || 'None'}</b>
                    </div>
                    <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${isActive ? 'var(--naija-green-light)' : '#fee2e2'}; color: ${isActive ? 'var(--naija-green-dark)' : '#dc2626'}; font-weight: bold;">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            `;
        });
        container.innerHTML = html || `<p style="color: var(--text-muted); font-size: 0.85rem;">No users match this filter.</p>`;
    });
}

function fetchAdminResultsLog() {
    const container = document.getElementById('adminResultsLog');
    const classFilter = document.getElementById('filterResultClass') ? document.getElementById('filterResultClass').value : 'ALL';
    if (!container) return;
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading student results log...</p>`;

    db.collection('users').orderBy('username', 'asc').get().then(userSnap => {
        let userMap = {};
        userSnap.forEach(doc => { userMap[doc.id] = doc.data(); });

        db.collection('exam_results').orderBy('timestamp', 'desc').get().then(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No student scores recorded yet.</p>`;
                return;
            }

            let resultsArray = [];
            snapshot.forEach(doc => {
                let res = doc.data();
                let userObj = userMap[res.userId] || { username: "Unknown User", email: "", assignedClass: "Unassigned", passportUrl: "" };
                resultsArray.push({ id: doc.id, ...res, user: userObj });
            });

            resultsArray.sort((a, b) => a.user.username.localeCompare(b.user.username));

            let html = `<div style="display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto;">`;
            let filteredCount = 0;

            resultsArray.forEach(res => {
                let assignedClass = res.user.assignedClass || 'None';
                if (classFilter !== 'ALL' && assignedClass !== classFilter) return;

                filteredCount++;
                let passportPreview = res.user.passportUrl 
                    ? `<img src="${res.user.passportUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--naija-green);">` 
                    : `<div style="width: 32px; height: 32px; background: var(--naija-green-light); color: var(--naija-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;"><i class="fa-solid fa-user"></i></div>`;

                html += `
                    <div style="background: var(--card-bg); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${passportPreview}
                            <div>
                                <b>${res.user.username}</b> (${assignedClass})<br>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">Exam: ${res.examType} | Score: <b>${res.score} / ${res.total}</b></span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: bold; color: ${res.percentage >= 50 ? 'var(--naija-green)' : '#dc2626'};">${res.percentage}%</span>
                            <button onclick="openProfileModal('${res.userId}')" class="primary-btn" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-eye"></i> View Profile</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = filteredCount > 0 ? html : `<p style="color: var(--text-muted); font-size: 0.85rem;">No results found for this class filter.</p>`;
        });
    });
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
        let filterRSelect = document.getElementById('filterResultClass');
        
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
        if (filterRSelect && filterRSelect.options.length <= 1) filterRSelect.innerHTML = filterOptionsHtml;
    });
}

function fetchTeachersList() {
    const container = document.getElementById('teachersListContainer');
    if (!container) return;
    const classFilter = document.getElementById('filterTeacherClass') ? document.getElementById('filterTeacherClass').value : 'ALL';
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading teachers...</p>`;

    db.collection('users').where('role', '==', 'teacher').get().then(teacherSnap => {
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
                        <span style="color: var(--text-muted); font-size: 0.75rem;">Class: <b>${assignedClass}</b></span>
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
    const assignedClass = document.getElementById('teacherClassDropdownSelect').value;
    const gender = document.getElementById('teacherGenderSelect').value;

    if (!name || !email) {
        alert("Please enter teacher name and email.");
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
        role: 'teacher',
        assignedClass: assignedClass || 'None',
        gender: gender,
        isRegisteredByAdmin: true,
        createdAt: new Date()
    }).then(() => {
        alert(`Teacher ${title} ${name} pre-registered successfully!`);
        document.getElementById('teacherNameInput').value = '';
        document.getElementById('teacherEmailInput').value = '';
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

function fetchStudentsList() {
    const container = document.getElementById('studentsListContainer');
    if (!container) return;
    const classFilter = document.getElementById('filterStudentClass') ? document.getElementById('filterStudentClass').value : 'ALL';
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Loading students...</p>`;

    db.collection('users').where('role', '==', 'student').get().then(snapshot => {
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
                        <span style="color: var(--text-muted); font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Track: <b>${s.examTrack || 'ALL'}</b></span>
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
    const studentClass = document.getElementById('studentClassDropdownSelect').value;
    const examTrack = document.getElementById('studentExamTrackSelect').value;
    const gender = document.getElementById('studentGenderSelect').value;

    if (!name || !email || !studentClass) {
        alert("Please fill in student name, email, and select class.");
        return;
    }
    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }

    db.collection('users').add({
        username: name,
        email: email,
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
                <p><b>Role:</b> <span>${u.role.toUpperCase()}</span></p>
                <p><b>Assigned Class:</b> <span>${u.assignedClass || 'None'}</span></p>
                <p><b>Gender:</b> <span>${u.gender || 'N/A'}</span></p>
                ${trackRow}
                <p><b>Registered On:</b> <span>${u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span></p>
            `;
            document.getElementById('profileModal').classList.remove('hidden');
        }
    });
}
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }

// Question Bank Management & CSV Upload with Image Support
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
    document.getElementById('saveQuestionBtn').innerText = "Save Question to Firestore";
    document.getElementById('cancelEditBtn').classList.add('hidden');
}

function editQuestion(docId) {
    db.collection('questions').doc(docId).get().then(doc => {
        if (doc.exists) {
            const q = doc.data();
            document.getElementById('editQuestionId').value = doc.id;
            document.getElementById('singleExamType').value = q.examType;
            document.getElementById('singleSubject').value = q.subject;
            document.getElementById('singleYear').value = q.year;
            document.getElementById('singleQuestionText').value = q.questionText;
            document.getElementById('singleImageUrl').value = q.imageUrl || '';
            document.getElementById('singleOptA').value = q.options.A;
            document.getElementById('singleOptB').value = q.options.B;
            document.getElementById('singleOptC').value = q.options.C;
            document.getElementById('singleOptD').value = q.options.D;
            document.getElementById('singleCorrect').value = q.correctOption;
            document.getElementById('singleExplanation').value = q.explanation;
            
            document.getElementById('saveQuestionBtn').innerText = "Update Question";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function viewFullQuestion(docId) {
    db.collection('questions').doc(docId).get().then(doc => {
        if (doc.exists) {
            const q = doc.data();
            let imgHtml = q.imageUrl ? `<div style="margin-top:10px;"><img src="${q.imageUrl}" style="max-width:100%; max-height:220px; border-radius:6px;"></div>` : '';
            const modalContent = document.getElementById('modalQuestionContent');
            if (modalContent) {
                modalContent.innerHTML = `
                    <p><b>Exam Track:</b> ${q.examType} | <b>Subject:</b> ${q.subject} | <b>Year:</b> ${q.year}</p>
                    <p style="background: var(--bg-gray); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); margin-top: 8px;"><b>Question:</b><br>${q.questionText}</p>
                    ${imgHtml}
                    <ul style="list-style-type: none; display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">
                        <li><b>A.</b> ${q.options.A}</li>
                        <li><b>B.</b> ${q.options.B}</li>
                        <li><b>C.</b> ${q.options.C}</li>
                        <li><b>D.</b> ${q.options.D}</li>
                    </ul>
                    <p style="color: var(--naija-green); font-weight: bold; margin-top: 8px;">Correct Option: ${q.correctOption}</p>
                    <p style="font-style: italic; color: var(--text-muted); margin-top: 4px;">Explanation: ${q.explanation}</p>
                `;
            }
            document.getElementById('questionViewModal').classList.remove('hidden');
        }
    });
}
function closeQuestionModal() { document.getElementById('questionViewModal').classList.add('hidden'); }

function togglePublishStatus(docId, currentStatus) {
    db.collection('questions').doc(docId).update({ isPublished: !currentStatus }).then(() => {
        fetchQuestionsForManagement(currentManagedTrack);
    });
}

function fetchQuestionsForManagement(examType) {
    currentManagedTrack = examType;
    ['JAMB', 'WAEC', 'NECO'].forEach(t => {
        const btn = document.getElementById(`btnManage${t}`);
        if(btn) btn.className = t === examType ? "admin-tab-btn active" : "admin-tab-btn";
    });

    const delInput = document.getElementById('deleteConfirmationInput');
    if(delInput) delInput.value = '';
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
        if (snapshot.empty) {
            listEl.innerHTML = `<p class="muted-text">No questions stored for ${examType}.</p>`;
            return;
        }

        let html = `<p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 8px;">Total ${examType} Questions: ${snapshot.size}</p>`;
        snapshot.forEach(doc => {
            const q = doc.data();
            const isPub = q.isPublished !== false;
            html += `
                <div style="background: var(--card-bg); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--border-color); font-size: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                        <div>
                            <b>[${q.subject}]</b> Year: ${q.year} | Status: <span style="color: ${isPub ? 'var(--naija-green)' : '#d97706'}; font-weight: bold;">${isPub ? 'Published' : 'Unpublished'}</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="viewFullQuestion('${doc.id}')" title="View Full Question" style="background: #4b5563; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="togglePublishStatus('${doc.id}', ${isPub})" title="Publish/Unpublish" style="background: ${isPub ? '#d97706' : 'var(--naija-green)'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                            <button onclick="editQuestion('${doc.id}')" title="Edit" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteSingleQuestion('${doc.id}')" title="Delete" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <p style="color: var(--text-color);">${q.questionText}</p>
                </div>
            `;
        });
        listEl.innerHTML = html;
    });
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

// CSV Template & Parsing with Image Support
function downloadCSVTemplate(examType) {
    let csvContent = "question_id,examType,subject,year,question_text,image_url,option_a,option_b,option_c,option_d,correct_option,explanation\n";
    NIGERIAN_SUBJECTS.forEach((sub) => {
        const idCode = sub.substring(0, 3).toUpperCase();
        csvContent += `${examType}_${idCode}_001,${examType},${sub},2026,"Sample ${examType} question for ${sub}.",https://example.com/image.png,Option A,Option B,Option C,Option D,A,"Explanation for ${sub}."\n`;
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
    if (!fileInput || fileInput.files.length === 0) {
        alert("Please select a CSV file first.");
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            alert("CSV file is empty or missing headers.");
            return;
        }
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
        }).catch(err => alert("CSV Upload Error: " + err.message));
    };
    reader.readAsText(file);
}

// Video Hub Management (Fully Clickable & Functional)
function saveAdminVideo() {
    const title = document.getElementById('videoTitleInput').value.trim();
    const subject = document.getElementById('videoSubjectSelect').value;
    const url = document.getElementById('videoUrlInput').value.trim();

    if (!title || !subject || !url) {
        alert("Please fill in all video details.");
        return;
    }

    db.collection('videos').add({
        title: title,
        subject: subject,
        url: url,
        uploadedAt: new Date()
    }).then(() => {
        alert("Video lesson added successfully!");
        document.getElementById('videoTitleInput').value = '';
        document.getElementById('videoUrlInput').value = '';
        fetchAdminVideos();
    }).catch(err => alert("Error saving video: " + err.message));
}

function fetchAdminVideos() {
    const container = document.getElementById('adminVideosListContainer');
    if (!container) return;
    container.innerHTML = `<p class="muted-text">Loading videos...</p>`;

    db.collection('videos').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="muted-text">No video lessons uploaded yet.</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            let v = doc.data();
            html += `
                <div style="background: var(--card-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span><b>${v.subject}:</b> ${v.title}</span>
                    <button onclick="deleteAdminVideo('${doc.id}')" class="logout-btn" style="padding: 2px 6px; font-size: 0.7rem;">Delete</button>
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

function deleteAdminVideo(docId) {
    if (confirm("Delete this video?")) {
        db.collection('videos').doc(docId).delete().then(() => fetchAdminVideos());
    }
}

// Study Hub & Question Palette with Exam Filtering
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

function switchStudyViewMode(mode) {
    const qBtn = document.getElementById('studyTabQuestionsBtn');
    const vBtn = document.getElementById('studyTabVideosBtn');
    const qCont = document.getElementById('studyQuestionsContainer');
    const vCont = document.getElementById('studyVideosContainer');

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

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">';
        snapshot.forEach(doc => {
            let v = doc.data();
            html += `
                <div class="content-box" style="margin-bottom: 0; background: var(--card-bg); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px;">
                    <h4 style="color: var(--naija-green); margin-bottom: 6px;">${v.subject}</h4>
                    <p style="font-weight: bold; font-size: 0.9rem; margin-bottom: 10px;">${v.title}</p>
                    <a href="${v.url}" target="_blank" class="primary-btn" style="display: inline-block; text-align: center; text-decoration: none; padding: 6px 12px; font-size: 0.8rem;"><i class="fa-solid fa-play"></i> Watch Video</a>
                </div>
            `;
        });
        html += '</div>';
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

    // Render palette buttons
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

function handleLogout() { auth.signOut().then(() => showLoggedOutUI()); }

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

    auth.signInWithEmailAndPassword(email, pass).catch(err => alert("Login Error: " + err.message));
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
            return;
        }

        let existingDocId = snapshot.docs[0].id;
        let existingData = snapshot.docs[0].data();

        let processSignup = (passportBase64 = "") => {
            auth.createUserWithEmailAndPassword(email, password)
                .then((cred) => {
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

function switchStudyHubTab(mode) {
    switchStudyViewMode(mode);
}