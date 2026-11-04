const firebaseConfig = {
    apiKey: "AIzaSyBccleW9TJfmp8bFChKwmIx-68pBrSUe-Y",
    authDomain: "elsa-cbt.firebaseapp.com",
    projectId: "elsa-cbt",
    storageBucket: "elsa-cbt.firebasestorage.app",
    messagingSenderId: "366734551874",
    appId: "1:366734551874:web:5cf9df6268c85173cef6db",
    measurementId: "G-D52762GFD4"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const PERMITTED_ADMINS = ["naeemahuthman1@gmail.com", "uthmanwasiudele@gmail.com"];
let currentSelectedExamType = "JAMB";
let chosenDurationMinutes = 120;
let timerInterval = null;
let currentExamQuestions = [];
let currentManagedTrack = "JAMB";
let isExamActive = false;
let activeProfileData = null;
let activeProfileId = null;
let availableExamSubjects = [];
let homeChartInstance = null;
let resultsChartInstance = null;

const NIGERIAN_SUBJECTS = [
    "Mathematics", "Use of English", "Physics", "Chemistry", "Biology",
    "Agricultural Science", "Economics", "Government", "Literature-in-English",
    "Christian Religious Knowledge (CRK)", "Islamic Religious Knowledge (IRK)", "Geography",
    "Financial Accounting", "Commerce", "Civic Education", "Computer Studies"
];

window.addEventListener('DOMContentLoaded', () => {
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

document.addEventListener("visibilitychange", function() {
    if (document.hidden && isExamActive) {
        alert("⚠️ SECURITY WARNING: Tab switching or leaving the browser detected! Your exam has been automatically submitted.");
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
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
        overlay.classList.add('hidden');
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
        indicator.className = "tab-indicator login-active";
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        indicator.className = "tab-indicator signup-active";
    }
}

function toggleSignupRoleFields() {
    const role = document.getElementById('signupRole').value;
    const titleGroup = document.getElementById('signupTeacherTitleGroup');
    if (role === 'teacher') {
        titleGroup.style.display = 'flex';
    } else {
        titleGroup.style.display = 'none';
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

        if (role === 'admin' || role === 'teacher') {
            document.getElementById('roleSpecificMenu').style.display = 'block';
        } else {
            document.getElementById('roleSpecificMenu').style.display = 'none';
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
        document.getElementById('statTotalStudents').innerText = studentsCount;
        document.getElementById('statTotalTeachers').innerText = teachersCount;
    });

    db.collection('classes').get().then(snapshot => {
        document.getElementById('statTotalClasses').innerText = snapshot.size;
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
        bannerRules.innerText = "Computer-Based Test featuring Use of English (compulsory: 60 Qs) and 3 chosen academic subjects (40 Qs each). Timed under official JAMB standards.";
        subjectSelectorArea.style.display = 'none';
        modesContainer.style.display = 'flex';
        chosenDurationMinutes = 120;
        selectTestDuration(120);
        generateJAMBSubjects();
    } else {
        // WAEC or NECO
        bannerTitle.innerText = `${examType} Senior School Certificate Examination Simulator`;
        bannerRules.innerText = `Select your preferred subjects (50 questions per subject, exactly 1 hour per subject). Total time and question count adjust dynamically!`;
        subjectSelectorArea.style.display = 'block';
        modesContainer.style.display = 'flex';
        document.getElementById('subjectCountSelect').value = "4";
        generateSubjectDropdowns();
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active-simulator'));
    document.getElementById(`nav${examType}`).classList.add('active-simulator');

    fetchAvailableSubjectsForExam(examType);
}

function fetchAvailableSubjectsForExam(examType) {
    db.collection('questions')
      .where('examType', '==', examType)
      .where('isPublished', '==', true)
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
    const count = parseInt(document.getElementById('subjectCountSelect').value) || 4;
    const container = document.getElementById('dynamicSubjectsContainer');
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

    // Set duration for WAEC/NECO (1 hour per subject)
    chosenDurationMinutes = count * 60;
    
    // Update the practice/duration mode info display dynamically
    const modeContainer = document.getElementById('cbtModesContainer');
    modeContainer.innerHTML = `
        <div style="background: var(--naija-green-light); border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; text-align: center; margin-bottom: 12px;">
            <span style="font-size: 0.8rem; font-weight: bold; color: var(--naija-green-dark);">DYNAMIC EXAM DURATION & QUESTION COUNT</span>
            <h3 style="color: var(--naija-green-dark); font-size: 1.3rem; margin-top: 4px;">${count} Subject${count > 1 ? 's' : ''} = ${count * 50} Total Questions</h3>
            <span style="font-size: 0.85rem; color: #166534; font-weight: bold;">Total Time Allowed: ${chosenDurationMinutes} Minutes (${count} Hour${count > 1 ? 's' : ''})</span>
        </div>
        <button id="proceedExamBtn" onclick="launchStandaloneExam()" class="primary-btn muted-btn" disabled style="opacity: 0.5; cursor: not-allowed; width: 100%;">Proceed to Exam</button>
    `;

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

// Fisher-Yates Random Shuffle for randomized question selection per session
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Launch Standalone Fullscreen CBT Window
function launchStandaloneExam() {
    document.getElementById('cbtCustomizerCard').classList.add('hidden');
    document.getElementById('standaloneCbtWindow').classList.remove('hidden');
    document.getElementById('standaloneExamBadge').innerText = `${currentSelectedExamType} CBT`;
    isExamActive = true;
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `<p style="text-align: center; color: var(--naija-green); font-weight: bold; padding: 20px;">Assembling randomized question paper for ${currentSelectedExamType}...</p>`;

    let selectedSubjects = [];
    if (currentSelectedExamType === 'JAMB') {
        selectedSubjects.push({ subject: "Use of English", count: (chosenDurationMinutes === 40 ? 20 : 60) });
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if(sel.value) selectedSubjects.push({ subject: sel.value, count: (chosenDurationMinutes === 40 ? 10 : 40) });
        });
    } else {
        // WAEC / NECO (50 questions per subject)
        document.querySelectorAll('.subject-picker').forEach(sel => {
            if(sel.value) selectedSubjects.push({ subject: sel.value, count: 50 });
        });
        chosenDurationMinutes = selectedSubjects.length * 60;
    }

    db.collection('questions')
      .where('examType', '==', currentSelectedExamType)
      .where('isPublished', '==', true)
      .get()
      .then((snapshot) => {
          if (snapshot.empty) {
              container.innerHTML = `
                  <div style="padding: 20px; text-align: center; color: #dc2626; font-weight: bold;">
                      No published questions found in database for ${currentSelectedExamType}!<br>
                      <span style="font-size: 0.85rem; color: #4b5563; font-weight: normal;">Please ensure questions are published in the Admin Control Panel.</span>
                  </div>
              `;
              isExamActive = false;
              return;
          }

          let allDbQuestions = [];
          snapshot.forEach((doc) => {
              allDbQuestions.push({ id: doc.id, ...doc.data() });
          });

          let assembledPaper = [];
          selectedSubjects.forEach(subObj => {
              let subPool = allDbQuestions.filter(q => q.subject === subObj.subject);
              subPool = shuffleArray(subPool); // Random selection
              let sliced = subPool.slice(0, subObj.count);
              
              // If database has fewer questions than required, fallback to duplicate/shuffle pool
              while(sliced.length < subObj.count && subPool.length > 0) {
                  let extra = subPool[Math.floor(Math.random() * subPool.length)];
                  sliced.push({ ...extra, id: extra.id + '_' + Math.random() });
              }
              assembledPaper = assembledPaper.concat(sliced);
          });

          currentExamQuestions = shuffleArray(assembledPaper);

          let questionsHTML = '';
          currentExamQuestions.forEach((q, index) => {
              questionsHTML += `
                  <div style="padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 16px;">
                      <p style="font-weight: bold; margin-bottom: 12px; color: #1f2937;">
                          ${index + 1}. [${q.subject} - ${q.year}] ${q.questionText}
                      </p>
                      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem;">
                          <label><input type="radio" name="q_${q.id}" value="A"> A. ${q.options.A}</label>
                          <label><input type="radio" name="q_${q.id}" value="B"> B. ${q.options.B}</label>
                          <label><input type="radio" name="q_${q.id}" value="C"> C. ${q.options.C}</label>
                          <label><input type="radio" name="q_${q.id}" value="D"> D. ${q.options.D}</label>
                      </div>
                  </div>
              `;
          });

          container.innerHTML = questionsHTML;
          startTimer(chosenDurationMinutes * 60);
      })
      .catch((err) => {
          container.innerHTML = `<p style="color: red;">Error fetching questions: ${err.message}</p>`;
          isExamActive = false;
      });
}

function closeStandaloneCbtWindow() {
    if (confirm("Are you sure you want to exit the CBT simulator? Your current test progress will be lost.")) {
        clearInterval(timerInterval);
        isExamActive = false;
        document.getElementById('standaloneCbtWindow').classList.add('hidden');
        launchExamMode(currentSelectedExamType);
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

        document.getElementById('cbtTimer').innerText = `Time Left: ${displayStr}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Time is up! Examination submitted automatically.");
            submitExamManually();
        }
        timeRemaining--;
    }, 1000);
}

// Calculator Logic
function toggleCBTCalculator() {
    document.getElementById('cbtCalculatorBox').classList.toggle('hidden');
}
function calcClear() { document.getElementById('calcScreen').value = '0'; }
function calcAppend(val) {
    let screen = document.getElementById('calcScreen');
    if (screen.value === '0' && val !== '.') screen.value = val;
    else screen.value += val;
}
function calcBack() {
    let screen = document.getElementById('calcScreen');
    screen.value = screen.value.slice(0, -1) || '0';
}
function calcCompute() {
    let screen = document.getElementById('calcScreen');
    try { screen.value = eval(screen.value.replace('×', '*')) || '0'; }
    catch(e) { screen.value = 'Error'; }
}

// WAEC / NECO Grade Mapping Function
function getWaecNecoGrade(percentage) {
    if (percentage >= 75) return { grade: "A1", remark: "Excellent", status: "Distinction" };
    if (percentage >= 70) return { grade: "B2", remark: "Very Good", status: "Distinction" };
    if (percentage >= 65) return { grade: "B3", remark: "Good", status: "Distinction" };
    if (percentage >= 60) return { grade: "C4", remark: "Credit", status: "Credit" };
    if (percentage >= 55) return { grade: "C5", remark: "Credit", status: "Credit" };
    if (percentage >= 50) return { grade: "C6", remark: "Credit", status: "Minimum Credit (Pass for entry)" };
    if (percentage >= 45) return { grade: "D7", remark: "Pass", status: "Ordinary Pass (Not accepted as a credit)" };
    if (percentage >= 40) return { grade: "E8", remark: "Pass / Weak Pass", status: "Ordinary Pass (Not accepted as a credit)" };
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

    currentExamQuestions.forEach((q, idx) => {
        const selectedOption = document.querySelector(`input[name="q_${q.id}"]:checked`);
        const userChoice = selectedOption ? selectedOption.value : "NONE";
        const isCorrect = userChoice === q.correctOption;

        if (!subjectStats[q.subject]) {
            subjectStats[q.subject] = { total: 0, correct: 0 };
        }
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
                <p style="color: #4b5563; margin-top: 2px;">
                    Your Answer: <b>${userChoice}</b> | Correct Answer: <b style="color: var(--naija-green);">${q.correctOption}</b>
                </p>
                <p style="color: #6b7280; font-size: 0.8rem; font-style: italic; margin-top: 4px;">
                    💡 Explanation: ${q.explanation || 'No explanation provided.'}
                </p>
            </div>
        `;
    });

    let percentage = Math.round((totalCorrect / (totalQuestions || 1)) * 100);
    document.getElementById('overallPercentageBadge').innerText = `${percentage}%`;
    document.getElementById('resultsTimestamp').innerText = `Completed on ${new Date().toLocaleString()}`;

    let finalScaledScore = 0;
    let scoreHeaderLabel = "TOTAL SCORE";
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
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f9fafb; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; flex-wrap: wrap; gap: 4px;">
                <span><b>${sub}</b> (${subCorrect}/${subTotal})${subExtraInfo}</span>
                <span style="font-weight: bold; color: ${subAcc >= 50 ? 'var(--naija-green)' : '#dc2626'};">${subAcc}%</span>
            </div>
        `;
    }

    if (lowestPercentage === 100 || Object.keys(subjectStats).length === 0) {
        weakestSub = "None";
    }

    document.getElementById('resWeakSubject').innerText = weakestSub === "None" ? "None" : `${weakestSub} (${lowestPercentage}%)`;
    document.getElementById('resSubjectBreakdownList').innerHTML = breakdownHTML;
    document.getElementById('resDetailedReviewList').innerHTML = reviewHTML;

    saveExamResultToFirestore(currentSelectedExamType, percentage, totalCorrect, totalQuestions, finalScaledScore, subjectStats);
}

function closeStandaloneResultsWindow() {
    document.getElementById('standaloneResultsWindow').classList.add('hidden');
    showView('viewHome');
}

function saveExamResultToFirestore(examType, percentage, score, total, scaledScore, subjectStats) {
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
        timestamp: new Date()
    }).then(() => {
        renderHomeAnalyticsChart(uid);
    });
}

// Exam Records & History View
function showExamHistoryView() {
    showView('viewHistory');
    const container = document.getElementById('examHistoryListContainer');
    container.innerHTML = `<p style="color: #6b7280;">Loading exam records...</p>`;

    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    db.collection('exam_results')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .get()
      .then(snapshot => {
          if (snapshot.empty) {
              container.innerHTML = `<p style="color: #6b7280;">No past exam sessions recorded yet. Take a CBT simulator test to populate your history!</p>`;
              return;
          }

          let html = '';
          snapshot.forEach(doc => {
              let res = doc.data();
              let dateStr = res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : 'Recent';
              html += `
                  <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                      <div>
                          <h4 style="color: var(--naija-green); margin-bottom: 2px;">${res.examType} Examination Session</h4>
                          <p style="font-size: 0.8rem; color: #4b5563;">Completed on: ${dateStr}</p>
                          <p style="font-size: 0.85rem; font-weight: bold; margin-top: 4px;">Score: ${res.score} / ${res.total} (${res.percentage}%)</p>
                      </div>
                      <span class="brand-badge" style="background: var(--naija-green-light); color: var(--naija-green-dark);">${res.percentage}% Success</span>
                  </div>
              `;
          });
          container.innerHTML = html;
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

          const ctx = document.getElementById('homeAnalyticsChart').getContext('2d');
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

/* Admin Tab Switching */
function switchAdminTab(tab) {
    const panels = ['Classes', 'Teachers', 'Students', 'Questions', 'Results'];
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
    if (tab === 'teachers') {
        populateClassDropdowns();
        fetchTeachersList();
    }
    if (tab === 'students') {
        populateClassDropdowns();
        fetchStudentsList();
    }
    if (tab === 'questions') fetchQuestionsForManagement('JAMB');
    if (tab === 'results') fetchAdminResultsLog();
}

function fetchAdminResultsLog() {
    const container = document.getElementById('adminResultsLog');
    container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">Loading student scores log...</p>`;

    db.collection('exam_results').orderBy('timestamp', 'desc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: #6b7280; font-size: 0.9rem;">No student scores recorded yet.</p>`;
            return;
        }

        let html = `<div style="display: flex; flex-direction: column; gap: 8px; max-height: 350px; overflow-y: auto;">`;
        snapshot.forEach(doc => {
            let res = doc.data();
            html += `
                <div style="background: #f9fafb; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; flex-wrap: wrap; gap: 6px;">
                    <div>
                        <b>Exam:</b> ${res.examType} | <b>Score:</b> ${res.score} / ${res.total}
                    </div>
                    <div>
                        <span style="font-weight: bold; color: ${res.percentage >= 50 ? 'var(--naija-green)' : '#dc2626'};">${res.percentage}%</span>
                        <span style="color: #6b7280; font-size: 0.75rem; margin-left: 10px;">${res.timestamp ? new Date(res.timestamp.toDate()).toLocaleString() : ''}</span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    });
}

function createNewClass() {
    const className = document.getElementById('newClassNameInput').value.trim();
    if (!className) {
        alert("Please enter a class name.");
        return;
    }

    db.collection('classes').add({
        className: className,
        createdAt: new Date()
    }).then(() => {
        alert(`Class "${className}" created successfully!`);
        document.getElementById('newClassNameInput').value = '';
        fetchClassesList();
        populateClassDropdowns();
        updateDashboardCounters();
    }).catch(err => alert("Error creating class: " + err.message));
}

function fetchClassesList() {
    const container = document.getElementById('classListContainer');
    container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">Loading classes...</p>`;

    db.collection('classes').orderBy('createdAt', 'desc').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">No custom classes created yet.</p>`;
            document.getElementById('classesCountHeader').innerText = `All Created Classes & Rosters (0)`;
            return;
        }

        db.collection('users').where('role', '==', 'student').get().then(studentSnap => {
            let studentCounts = {};
            studentSnap.forEach(doc => {
                let sClass = doc.data().assignedClass || "Unassigned";
                studentCounts[sClass] = (studentCounts[sClass] || 0) + 1;
            });

            let html = '';
            let count = 0;
            snapshot.forEach(doc => {
                count++;
                const data = doc.data();
                const studentEnrolledCount = studentCounts[data.className] || 0;
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <b>${data.className}</b> <span style="color: #6b7280; font-size: 0.75rem;">(${studentEnrolledCount} Students Enrolled)</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="viewClassRoster('${data.className}')" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="View Students"><i class="fa-solid fa-users"></i></button>
                            <button onclick="deleteClass('${doc.id}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Delete Class"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
            document.getElementById('classesCountHeader').innerText = `All Created Classes & Rosters (${count})`;
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
            rosterHTML += `<p style="color: #6b7280; font-size: 0.85rem;">No students enrolled in this class.</p>`;
        } else {
            snapshot.forEach(doc => {
                let s = doc.data();
                rosterHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f9fafb; padding:6px 10px; margin-bottom:4px; border-radius:4px; border:1px solid #e5e7eb; font-size:0.85rem;">
                        <span><i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${s.username}</b> (${s.email})</span>
                        <div style="display:flex; gap:4px;">
                            <button onclick="openProfileModal('${doc.id}')" style="background:#4b5563; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="View Profile"><i class="fa-solid fa-user"></i></button>
                            <button onclick="openReassignModal('${doc.id}')" style="background:#d97706; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="Assign / De-assign"><i class="fa-solid fa-chalkboard-user"></i></button>
                            <button onclick="removeStudentFromClass('${doc.id}')" style="background:#dc2626; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="Remove from class"><i class="fa-solid fa-user-minus"></i></button>
                        </div>
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
    const classFilter = document.getElementById('filterTeacherClass') ? document.getElementById('filterTeacherClass').value : 'ALL';
    container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">Loading teachers...</p>`;

    db.collection('users').where('role', '==', 'teacher').get().then(teacherSnap => {
        if (teacherSnap.empty) {
            container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">No teachers registered yet.</p>`;
            document.getElementById('teachersCountHeader').innerText = `All Registered Teachers (0)`;
            return;
        }

        db.collection('users').where('role', '==', 'student').get().then(studentSnap => {
            let classStudentCounts = {};
            studentSnap.forEach(doc => {
                let c = doc.data().assignedClass;
                if(c) classStudentCounts[c] = (classStudentCounts[c] || 0) + 1;
            });

            let html = '';
            let filteredCount = 0;

            teacherSnap.forEach(doc => {
                let t = doc.data();
                let assignedClass = t.assignedClass || "None";
                
                if (classFilter !== 'ALL' && assignedClass !== classFilter) {
                    return;
                }

                filteredCount++;
                let studentCount = assignedClass !== "None" ? (classStudentCounts[assignedClass] || 0) : 0;
                let titlePrefix = t.teacherTitle ? `${t.teacherTitle} ` : "";

                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${titlePrefix}${t.username}</b> (${t.email})<br>
                            <span style="color: #4b5563; font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Students Managed: <b>${studentCount}</b></span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="openProfileModal('${doc.id}')" style="background: #4b5563; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="View Profile"><i class="fa-solid fa-user"></i></button>
                            <button onclick="openReassignModal('${doc.id}')" style="background: #2563eb; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Assign / De-assign Class"><i class="fa-solid fa-chalkboard-user"></i></button>
                            <button onclick="deleteTeacherAccount('${doc.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Delete Teacher"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });

            document.getElementById('teachersCountHeader').innerText = `All Registered Teachers (${filteredCount})`;
            container.innerHTML = html || `<p style="color: #6b7280; font-size: 0.85rem;">No teachers found for this class filter.</p>`;
        });
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

    db.collection('users').where('email', '==', email).get().then(snapshot => {
        if (!snapshot.empty) {
            alert("A user with this email is already pre-registered!");
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
            alert(`Teacher ${title} ${name} pre-registered successfully! They can now sign up securely.`);
            document.getElementById('teacherNameInput').value = '';
            document.getElementById('teacherEmailInput').value = '';
            document.getElementById('teacherEmailWarning').classList.add('hidden');
            fetchTeachersList();
            updateDashboardCounters();
        });
    });
}

function deleteTeacherAccount(docId) {
    if (confirm("Are you sure you want to delete this teacher record?")) {
        db.collection('users').doc(docId).delete().then(() => {
            fetchTeachersList();
            updateDashboardCounters();
        });
    }
}

function fetchStudentsList() {
    const container = document.getElementById('studentsListContainer');
    const classFilter = document.getElementById('filterStudentClass') ? document.getElementById('filterStudentClass').value : 'ALL';
    container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">Loading students...</p>`;

    db.collection('users').where('role', '==', 'student').get().then(snapshot => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">No students registered yet.</p>`;
            document.getElementById('studentsCountHeader').innerText = `All Registered Students (0)`;
            return;
        }

        let html = '';
        let filteredCount = 0;

        snapshot.forEach(doc => {
            let s = doc.data();
            let assignedClass = s.assignedClass || 'None';

            if (classFilter !== 'ALL' && assignedClass !== classFilter) {
                return;
            }

            filteredCount++;
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <i class="fa-solid fa-user" style="color:var(--naija-green); margin-right:6px;"></i><b>${s.username}</b> (${s.email})<br>
                        <span style="color: #4b5563; font-size: 0.75rem;">Class: <b>${assignedClass}</b> | Track: <b>${s.examTrack || 'ALL'}</b></span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="openProfileModal('${doc.id}')" style="background: #4b5563; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="View Profile"><i class="fa-solid fa-user"></i></button>
                        <button onclick="openReassignModal('${doc.id}')" style="background: #2563eb; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Assign / De-assign Class"><i class="fa-solid fa-chalkboard-user"></i></button>
                        <button onclick="deleteStudentAccount('${doc.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Delete Student"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        document.getElementById('studentsCountHeader').innerText = `All Registered Students (${filteredCount})`;
        container.innerHTML = html || `<p style="color: #6b7280; font-size: 0.85rem;">No students found for this class filter.</p>`;
    });
}

function registerStudentByAdmin() {
    const name = document.getElementById('studentNameInput').value.trim();
    const email = document.getElementById('studentEmailInput').value.trim().toLowerCase();
    const studentClass = document.getElementById('studentClassDropdownSelect').value;
    const examTrack = document.getElementById('studentExamTrackSelect').value;
    const gender = document.getElementById('studentGenderSelect').value;

    if (!name || !email || !studentClass) {
        alert("Please fill in student name, email, and select an available class.");
        return;
    }

    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }

    db.collection('users').where('email', '==', email).get().then(snapshot => {
        if (!snapshot.empty) {
            alert("A student with this email is already pre-registered!");
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
            alert(`Student ${name} pre-registered successfully! They can now sign up securely.`);
            document.getElementById('studentNameInput').value = '';
            document.getElementById('studentEmailInput').value = '';
            document.getElementById('studentEmailWarning').classList.add('hidden');
            fetchStudentsList();
            updateDashboardCounters();
        });
    });
}

function deleteStudentAccount(docId) {
    if (confirm("Are you sure you want to delete this student record?")) {
        db.collection('users').doc(docId).delete().then(() => {
            fetchStudentsList();
            updateDashboardCounters();
        });
    }
}

function removeStudentFromClass(docId) {
    if (confirm("Remove this student from their class?")) {
        db.collection('users').doc(docId).update({ assignedClass: "Unassigned" }).then(() => {
            fetchStudentsList();
        });
    }
}

function openReassignModal(userId) {
    document.getElementById('reassignUserId').value = userId;
    db.collection('classes').get().then(snapshot => {
        let select = document.getElementById('reassignClassSelect');
        let optionsHtml = '<option value="None">-- Unassigned / None --</option>';
        snapshot.forEach(doc => {
            let c = doc.data().className;
            optionsHtml += `<option value="${c}">${c}</option>`;
        });
        select.innerHTML = optionsHtml;
        document.getElementById('reassignModal').classList.remove('hidden');
    });
}
function closeReassignModal() { document.getElementById('reassignModal').classList.add('hidden'); }
function saveUserReassignment() {
    let userId = document.getElementById('reassignUserId').value;
    let newClass = document.getElementById('reassignClassSelect').value;
    db.collection('users').doc(userId).update({ assignedClass: newClass }).then(() => {
        alert("Class assignment updated successfully!");
        closeReassignModal();
        fetchStudentsList();
        fetchTeachersList();
    });
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

function openEditProfileModal() {
    if (!activeProfileData || !activeProfileId) return;
    document.getElementById('editUserId').value = activeProfileId;
    document.getElementById('editUserRole').value = activeProfileData.role || 'student';
    document.getElementById('editProfileName').value = activeProfileData.username || '';
    document.getElementById('editProfileEmail').value = activeProfileData.email || '';
    document.getElementById('editProfileGender').value = activeProfileData.gender || 'Male';

    const trackGroup = document.getElementById('editProfileTrackGroup');
    const titleGroup = document.getElementById('editTeacherTitleGroup');

    if (activeProfileData.role === 'teacher') {
        trackGroup.style.display = 'none';
        titleGroup.style.display = 'flex';
        document.getElementById('editTeacherTitle').value = activeProfileData.teacherTitle || 'Mr.';
    } else {
        trackGroup.style.display = 'flex';
        titleGroup.style.display = 'none';
        document.getElementById('editProfileTrack').value = activeProfileData.examTrack || 'ALL';
    }
    
    populateClassDropdowns();
    setTimeout(() => {
        document.getElementById('editProfileClass').value = activeProfileData.assignedClass || 'None';
    }, 200);

    closeProfileModal();
    document.getElementById('editProfileModal').classList.remove('hidden');
}
function closeEditProfileModal() { document.getElementById('editProfileModal').classList.add('hidden'); }

function saveProfileEdits() {
    let userId = document.getElementById('editUserId').value;
    let userRole = document.getElementById('editUserRole').value;
    let newName = document.getElementById('editProfileName').value.trim();
    let newEmail = document.getElementById('editProfileEmail').value.trim().toLowerCase();
    let newGender = document.getElementById('editProfileGender').value;
    let newClass = document.getElementById('editProfileClass').value;

    if (!newName || !newEmail) {
        alert("Name and email cannot be empty.");
        return;
    }
    if (!newEmail.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }

    let updatePayload = {
        username: newName,
        email: newEmail,
        gender: newGender,
        assignedClass: newClass
    };

    if (userRole === 'teacher') {
        updatePayload.teacherTitle = document.getElementById('editTeacherTitle').value;
    } else {
        updatePayload.examTrack = document.getElementById('editProfileTrack').value;
    }

    db.collection('users').doc(userId).update(updatePayload).then(() => {
        alert("Profile updated successfully!");
        closeEditProfileModal();
        fetchStudentsList();
        fetchTeachersList();
    }).catch(err => alert("Error updating profile: " + err.message));
}

function downloadProfilePDF() {
    if (!activeProfileData) return;
    const element = document.getElementById('pdfProfileContent');
    const opt = {
        margin:       10,
        filename:     `${activeProfileData.username}_profile_slip.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
}

function downloadStudentCSVTemplate() {
    let csvContent = "username,email,assignedClass,examTrack,gender\nNaeemah Uthman,naeemah@gmail.com,SS 3 Gold,ALL,Female\nWasiu Uthman,wasiu@gmail.com,SS 3 Science,JAMB,Male\n";
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "elsa_student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseStudentCSV() {
    const fileInput = document.getElementById('studentCsvFileInput');
    if (fileInput.files.length === 0) {
        alert("Please select a student CSV file first.");
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
            const row = lines[i].split(',').map(col => col.replace(/^"|"$/g, '').trim());
            if (row.length >= 5) {
                let email = row[1].toLowerCase();
                if (!email.endsWith('@gmail.com')) continue;
                let newDocRef = db.collection('users').doc();
                batch.set(newDocRef, {
                    username: row[0],
                    email: email,
                    assignedClass: row[2],
                    examTrack: row[3].toUpperCase(),
                    gender: row[4],
                    role: 'student',
                    isRegisteredByAdmin: true,
                    createdAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`🎉 Successfully pre-registered ${count} students from CSV!`);
            fileInput.value = '';
            fetchStudentsList();
            updateDashboardCounters();
        }).catch(err => alert("Error uploading students: " + err.message));
    };
    reader.readAsText(file);
}

function downloadTeacherCSVTemplate() {
    let csvContent = "teacherTitle,username,email,assignedClass,gender\nMr.,Ade,ade.teacher@gmail.com,SS 3 Gold,Male\nMrs.,Ngozi,ngozi.teacher@gmail.com,SS 3 Science,Female\n";
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "elsa_teacher_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseTeacherCSV() {
    const fileInput = document.getElementById('teacherCsvFileInput');
    if (fileInput.files.length === 0) {
        alert("Please select a teacher CSV file first.");
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
            const row = lines[i].split(',').map(col => col.replace(/^"|"$/g, '').trim());
            if (row.length >= 5) {
                let email = row[2].toLowerCase();
                if (!email.endsWith('@gmail.com')) continue;
                let newDocRef = db.collection('users').doc();
                batch.set(newDocRef, {
                    teacherTitle: row[0],
                    username: row[1],
                    email: email,
                    assignedClass: row[3],
                    gender: row[4],
                    role: 'teacher',
                    isRegisteredByAdmin: true,
                    createdAt: new Date()
                });
                count++;
            }
        }
        batch.commit().then(() => {
            alert(`🎉 Successfully pre-registered ${count} teachers from CSV!`);
            fileInput.value = '';
            fetchTeachersList();
            updateDashboardCounters();
        }).catch(err => alert("Error uploading teachers: " + err.message));
    };
    reader.readAsText(file);
}

function downloadCSVTemplate(examType) {
    let csvContent = "question_id,examType,subject,year,question_text,option_a,option_b,option_c,option_d,correct_option,explanation\n";
    NIGERIAN_SUBJECTS.forEach((sub) => {
        const idCode = sub.substring(0, 3).toUpperCase();
        csvContent += `${examType}_${idCode}_001,${examType},${sub},2026,"Sample ${examType} past question for ${sub}.",Option A,Option B,Option C,Option D,A,"Explanation for ${sub}."\n`;
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

function checkDeleteConfirmation(input) {
    const btn = document.getElementById('dangerDeleteBtn');
    const targetText = `DELETE ${currentManagedTrack}`;
    if (input.value.trim().toUpperCase() === targetText) {
        btn.disabled = false;
        btn.style.background = "#dc2626";
        btn.style.cursor = "pointer";
    } else {
        btn.disabled = true;
        btn.style.background = "#9ca3af";
        btn.style.cursor = "not-allowed";
    }
}

function saveSingleQuestion() {
    const editId = document.getElementById('editQuestionId').value;
    const examType = document.getElementById('singleExamType').value;
    const subject = document.getElementById('singleSubject').value;
    const year = document.getElementById('singleYear').value.trim();
    const questionText = document.getElementById('singleQuestionText').value.trim();
    const optA = document.getElementById('singleOptA').value.trim();
    const optB = document.getElementById('singleOptB').value.trim();
    const optC = document.getElementById('singleOptC').value.trim();
    const optD = document.getElementById('singleOptD').value.trim();
    const correct = document.getElementById('singleCorrect').value;
    const explanation = document.getElementById('singleExplanation').value.trim();

    if (!subject || !questionText || !optA || !optB || !optC || !optD) {
        alert("Please fill in all required question fields and select a subject.");
        return;
    }

    const questionId = editId ? editId : `${examType}_${subject.substring(0,3).toUpperCase()}_${Date.now()}`;
    
    db.collection('questions').doc(questionId).set({
        questionId: questionId,
        examType: examType,
        subject: subject,
        year: year || "2026",
        questionText: questionText,
        options: { A: optA, B: optB, C: optC, D: optD },
        correctOption: correct,
        explanation: explanation || "No explanation provided.",
        isPublished: true,
        uploadedAt: new Date()
    }, { merge: true }).then(() => {
        alert(editId ? "Question updated successfully!" : "Single question added successfully!");
        resetQuestionForm();
        fetchQuestionsForManagement(currentManagedTrack);
    }).catch(err => alert(err.message));
}

function resetQuestionForm() {
    document.getElementById('editQuestionId').value = '';
    document.getElementById('singleSubject').selectedIndex = 0;
    document.getElementById('singleYear').value = '';
    document.getElementById('singleQuestionText').value = '';
    document.getElementById('singleOptA').value = '';
    document.getElementById('singleOptB').value = '';
    document.getElementById('singleOptC').value = '';
    document.getElementById('singleOptD').value = '';
    document.getElementById('singleExplanation').value = '';
    document.getElementById('saveQuestionBtn').innerText = "Save Question to Database";
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
            const modalContent = document.getElementById('modalQuestionContent');
            modalContent.innerHTML = `
                <p><b>Exam Track:</b> ${q.examType} | <b>Subject:</b> ${q.subject} | <b>Year:</b> ${q.year}</p>
                <p style="background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);"><b>Question:</b><br>${q.questionText}</p>
                <ul style="list-style-type: none; display: flex; flex-direction: column; gap: 4px;">
                    <li><b>A.</b> ${q.options.A}</li>
                    <li><b>B.</b> ${q.options.B}</li>
                    <li><b>C.</b> ${q.options.C}</li>
                    <li><b>D.</b> ${q.options.D}</li>
                </ul>
                <p style="color: var(--naija-green); font-weight: bold;">Correct Option: ${q.correctOption}</p>
                <p style="font-style: italic; color: #4b5563;">Explanation: ${q.explanation}</p>
            `;
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
    const delBtn = document.getElementById('dangerDeleteBtn');
    if(delBtn) {
        delBtn.disabled = true;
        delBtn.style.background = "#9ca3af";
        delBtn.style.cursor = "not-allowed";
    }

    const listEl = document.getElementById('questionBankList');
    listEl.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">Loading ${examType} question bank...</p>`;

    db.collection('questions').where('examType', '==', examType).get().then(snapshot => {
        if (snapshot.empty) {
            listEl.innerHTML = `<p style="color: #6b7280; font-size: 0.85rem;">No questions stored for ${examType} yet.</p>`;
            return;
        }

        let html = `<p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 8px;">Total ${examType} Questions: ${snapshot.size}</p>`;
        snapshot.forEach(doc => {
            const q = doc.data();
            const isPub = q.isPublished !== false;
            html += `
                <div style="background: white; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 0.8rem; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                        <div>
                            <b>[${q.subject}]</b> Year: ${q.year} | Status: <span style="color: ${isPub ? 'var(--naija-green)' : '#d97706'}; font-weight: bold;">${isPub ? 'Published' : 'Unpublished'}</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="viewFullQuestion('${doc.id}')" title="View Full Question" style="background: #4b5563; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="togglePublishStatus('${doc.id}', ${isPub})" title="Publish / Unpublish" style="background: ${isPub ? '#d97706' : 'var(--naija-green)'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                            <button onclick="editQuestion('${doc.id}')" title="Edit Question" style="background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteSingleQuestion('${doc.id}')" title="Delete Question" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <p style="color: #374151;">${q.questionText}</p>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }).catch(err => alert(err.message));
}

function deleteSingleQuestion(docId) {
    if (confirm("Are you sure you want to delete this question?")) {
        db.collection('questions').doc(docId).delete().then(() => {
            fetchQuestionsForManagement(currentManagedTrack);
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
    });
}

function parseCSVQuestions() {
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput.files.length === 0) {
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
        const parsedQuestions = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
            if (row.length >= 10) {
                parsedQuestions.push({
                    question_id: row[0] || `Q_${Date.now()}_${i}`,
                    examType: row[1] || "JAMB",
                    subject: row[2] || "Mathematics",
                    year: row[3] || "2026",
                    question_text: row[4],
                    option_a: row[5],
                    option_b: row[6],
                    option_c: row[7],
                    option_d: row[8],
                    correct_option: row[9],
                    explanation: row[10] || "No explanation provided."
                });
            }
        }
        if (parsedQuestions.length > 0) {
            uploadQuestionsToFirestore(parsedQuestions, fileInput);
        } else {
            alert("No valid question rows found in CSV.");
        }
    };
    reader.readAsText(file);
}

function uploadQuestionsToFirestore(questions, fileInput) {
    const batch = db.batch();
    questions.forEach(q => {
        const docRef = db.collection('questions').doc(q.question_id);
        batch.set(docRef, {
            questionId: q.question_id,
            examType: q.examType.toUpperCase().trim(),
            subject: q.subject.trim(),
            year: q.year.trim(),
            questionText: q.question_text,
            options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
            correctOption: q.correct_option.toUpperCase().trim(),
            explanation: q.explanation,
            isPublished: true,
            uploadedAt: new Date()
        });
    });
    batch.commit().then(() => {
        alert(`🎉 Successfully uploaded ${questions.length} questions into database!`);
        fileInput.value = '';
        fetchQuestionsForManagement('JAMB');
    }).catch(err => alert("Firestore Upload Error: " + err.message));
}

function openStudyModal() { document.getElementById('studyModal').classList.remove('hidden'); fetchStudyQuestionCount(); }
function closeStudyModal() { document.getElementById('studyModal').classList.add('hidden'); }

function fetchStudyQuestionCount() {
    const examType = document.getElementById('studyExamTypeSelect').value;
    const subject = document.getElementById('studySubjectSelect').value;
    const countDisplay = document.getElementById('studyQuestionCountDisplay');

    if (!subject) {
        countDisplay.innerText = "Please select a subject to check available questions.";
        return;
    }
    countDisplay.innerText = `Checking available ${examType} questions for ${subject}...`;

    db.collection('questions')
      .where('examType', '==', examType)
      .where('subject', '==', subject)
      .where('isPublished', '==', true)
      .get()
      .then(snapshot => {
          countDisplay.innerText = `📚 Available Questions in Bank: ${snapshot.size}`;
      })
      .catch(err => { countDisplay.innerText = "Error fetching question count."; });
}

function startStudySession() {
    const examType = document.getElementById('studyExamTypeSelect').value;
    const subject = document.getElementById('studySubjectSelect').value;

    if (!subject) {
        alert("Please select a subject for your study session.");
        return;
    }
    closeStudyModal();
    showView('viewStudyHub');
    document.getElementById('studyHubTitle').innerText = `📖 Study Hub: ${examType} - ${subject} (All Questions)`;

    const container = document.getElementById('studyQuestionsContainer');
    container.innerHTML = `<p style="text-align: center; color: var(--naija-green); font-weight: bold; padding: 20px;">Loading study questions for ${subject}...</p>`;

    db.collection('questions')
      .where('examType', '==', examType)
      .where('subject', '==', subject)
      .where('isPublished', '==', true)
      .get()
      .then((snapshot) => {
          if (snapshot.empty) {
              container.innerHTML = `<p style="text-align: center; color: #dc2626; font-weight: bold; padding: 20px;">No published questions found for ${subject} under ${examType}.</p>`;
              return;
          }

          let questions = [];
          snapshot.forEach((doc) => { questions.push({ id: doc.id, ...doc.data() }); });

          let questionsHTML = '';
          questions.forEach((q, index) => {
              let escapedExplanation = (q.explanation || 'No detailed explanation available.').replace(/"/g, '&quot;');
              let escapedCorrect = q.correctOption || 'A';
              
              questionsHTML += `
                  <div style="padding: 20px; background: white; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                      <p style="font-weight: bold; margin-bottom: 12px; color: #1f2937; font-size: 0.95rem;">
                          ${index + 1}. [Year: ${q.year}] ${q.questionText}
                      </p>
                      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; margin-bottom: 14px;">
                          <div style="padding: 6px 10px; background: #f9fafb; border-radius: 4px;"><b>A.</b> ${q.options.A}</div>
                          <div style="padding: 6px 10px; background: #f9fafb; border-radius: 4px;"><b>B.</b> ${q.options.B}</div>
                          <div style="padding: 6px 10px; background: #f9fafb; border-radius: 4px;"><b>C.</b> ${q.options.C}</div>
                          <div style="padding: 6px 10px; background: #f9fafb; border-radius: 4px;"><b>D.</b> ${q.options.D}</div>
                      </div>
                      <button onclick="openExplanationModal('${escapedCorrect}', '${escapedExplanation}')" class="primary-btn" style="background: #2563eb; font-size: 0.85rem; padding: 8px 14px;">
                          <i class="fa-solid fa-lightbulb"></i> View Explanation
                      </button>
                  </div>
              `;
          });
          container.innerHTML = questionsHTML;
      });
}

function openExplanationModal(correctOption, explanationText) {
    const body = document.getElementById('explanationModalBody');
    body.innerHTML = `
        <div style="background: var(--naija-green-light); padding: 12px; border-radius: 6px; border: 1px solid #bbf7d0;">
            <p style="font-weight: bold; color: var(--naija-green-dark); font-size: 1rem;">Correct Answer: ${correctOption}</p>
        </div>
        <div style="background: #f9fafb; padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
            <p style="font-weight: bold; margin-bottom: 4px; color: #374151;">Detailed Step-by-Step Solution:</p>
            <p style="color: #4b5563; line-height: 1.5;">${explanationText}</p>
        </div>
    `;
    document.getElementById('explanationModal').classList.remove('hidden');
}
function closeExplanationModal() { document.getElementById('explanationModal').classList.add('hidden'); }

function handleLogout() { auth.signOut().then(() => showLoggedOutUI()); }

function showLoggedOutUI() {
    document.getElementById('userStatusBadge').innerText = "Not Signed In";
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('hamburgerBtn').classList.add('hidden');
    document.getElementById('appSidebar').classList.add('hidden');
    document.getElementById('sidebarOverlay').classList.add('hidden');
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('authSection').classList.remove('hidden');
    switchAuthTab('login');
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }
    auth.signInWithEmailAndPassword(email, document.getElementById('loginPassword').value)
        .catch((err) => alert(err.message));
}

function handleSignupSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const role = document.getElementById('signupRole').value;
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const gender = document.getElementById('signupGender').value;
    const teacherTitle = document.getElementById('signupTeacherTitle').value;
    const passportInput = document.getElementById('signupPassportInput');

    if (!email.endsWith('@gmail.com')) {
        alert("⚠️ Please provide a valid @gmail.com address.");
        return;
    }
    if (role === 'admin' && !PERMITTED_ADMINS.includes(email)) {
        alert("Access Denied: Unrecognized email for Admin registration.");
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
                    alert("🎉 Account created successfully! Welcome to ELSA-CBT.");
                })
                .catch((err) => alert(err.message));
        };

        if (passportInput.files.length > 0) {
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