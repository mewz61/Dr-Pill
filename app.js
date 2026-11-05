// Demo medication list. Reminder times and prescription directions are not assumed.
const initialMockDatabase = [
    { id: 1, name: 'Hydrocortisone 1% cream', dosage: 'Apply a thin layer to the affected skin', route: 'Topical', condition: 'Eczema', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 2, name: 'Metformin prolonged-release (MR/SR)', dosage: '500mg', route: 'Oral tablet', condition: 'Type 2 diabetes', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 3, name: 'Amlodipine', dosage: '5mg', route: 'Oral tablet', condition: 'High blood pressure', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 4, name: 'Dapagliflozin', dosage: '10mg', route: 'Oral tablet', condition: 'Chronic kidney disease', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 5, name: 'Atorvastatin', dosage: '80mg', route: 'Oral', condition: 'High cholesterol', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 6, name: 'Lactulose', dosage: '30-50mL', route: 'Oral liquid', condition: 'Liver disease: hepatic encephalopathy', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 7, name: 'Naproxen', dosage: '250-500mg', route: 'Oral tablet', condition: 'Back pain, knee pain (musculoskeletal pain or osteoarthritis)', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 8, name: 'Amitriptyline', dosage: '10mg', route: 'Oral tablet', condition: 'Chronic nerve pain', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 9, name: 'Solifenacin', dosage: '5mg', route: 'Oral tablet', condition: 'Weak bladder', instructions: 'Enter the instructions on the prescription', time: '' },
    { id: 10, name: 'Omeprazole', dosage: '20mg', route: 'Oral tablet', condition: 'Digestive disorder: acid reflux/GORD', instructions: 'Enter the instructions on the prescription', time: '' }
];

function isValidMedication(medication) {
    return medication &&
        Number.isSafeInteger(medication.id) &&
        typeof medication.name === 'string' &&
        typeof medication.dosage === 'string' &&
        typeof medication.time === 'string' &&
        (medication.route === undefined || typeof medication.route === 'string') &&
        (medication.condition === undefined || typeof medication.condition === 'string') &&
        (medication.instructions === undefined || typeof medication.instructions === 'string');
}

const previousDemoNames = [
    'Vitamin D3', 'Amoxicillin', 'Ibuprofen', 'Lisinopril', 'Paracetamol',
    'Metformin', 'Atorvastatin', 'Omeprazole', 'Levothyroxine', 'Levocetirizine'
];

function isPreviousDemoList(list) {
    return list.length === previousDemoNames.length &&
        previousDemoNames.every(name => list.some(medication => medication.name === name));
}

// Load medications from localStorage, including a deliberately empty list.
let medications = [...initialMockDatabase];

try {
    const storedValue = localStorage.getItem('drPill_DB');
    if (storedValue !== null) {
        const savedMedications = JSON.parse(storedValue);
        if (Array.isArray(savedMedications)) {
            const validMedications = savedMedications.filter(isValidMedication);
            medications = isPreviousDemoList(validMedications)
                ? [...initialMockDatabase]
                : validMedications.map(medication => ({
                    ...medication,
                    route: medication.route || '',
                    condition: medication.condition || '',
                    instructions: medication.instructions || ''
                }));
        } else {
            console.warn('Saved medication data is invalid. Using the default medication list.');
        }
    }
} catch (error) {
    console.warn('Unable to load medication data. Using the default medication list.', error);
}

let nextMedicationId = medications.reduce(
    (nextId, medication) => Math.max(nextId, medication.id + 1),
    1
);
let streamRef = null;
let cameraRequestId = 0;
const remindedMedicationDates = new Set();
const activeDoseNotifications = new Set();
let reminderBeepIntervalId = null;
let reminderAudioContext = null;
let reminderSpeechRunId = 0;
let isSignedIn = false;
let reminderVoiceEnabled = true;

function createIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function populateMedicationSuggestions() {
    const suggestions = document.getElementById('medicationSuggestions');
    if (!suggestions) return;

    const names = new Set([
        ...initialMockDatabase.map(medication => medication.name),
        ...medications.map(medication => medication.name)
    ]);
    suggestions.textContent = '';
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        suggestions.appendChild(option);
    });
}

function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const email = emailInput.value.trim();
    if (!emailInput.checkValidity() || !document.getElementById('loginPassword').value) {
        document.getElementById('loginStatus').textContent = 'Enter a valid email address and password.';
        return;
    }

    const name = email.split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase()) || 'there';
    document.getElementById('profileName').textContent = name;
    document.getElementById('profileEmail').textContent = email;
    document.querySelector('.user-profile .avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('dashboardGreeting').textContent = `Welcome, ${name}`;
    document.getElementById('loginStatus').textContent = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    isSignedIn = true;
    prepareReminderAudio();
    checkMedicationReminders();
    createIcons();
}

function signOut() {
    stopCamera();
    isSignedIn = false;
    dismissReminder();
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginStatus').textContent = '';
    document.getElementById('loginEmail').focus();
}

// Switch Navigation Tabs
function switchTab(tabId) {
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (!selectedTab) return;

    if (tabId !== 'scanner') {
        stopCamera();
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn, .m-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });

    selectedTab.classList.add('active');
    createIcons();
}

// Render medications in the list without interpreting user-entered text as HTML.
function renderMedications() {
    const list = document.getElementById('medList');
    const counter = document.getElementById('pillCounter');

    if (!list) return;

    if (counter) {
        counter.textContent = `${medications.length} Prescriptions`;
    }

    list.textContent = '';
    if (medications.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No medications saved. Add one using the form.';
        list.appendChild(emptyMessage);
    }

    medications.forEach(medication => {
        const item = document.createElement('div');
        item.className = 'med-item';

        const details = document.createElement('div');
        const name = document.createElement('h4');
        name.textContent = medication.name;
        const schedule = document.createElement('p');
        const routeAndCondition = [medication.route, medication.condition].filter(Boolean).join(' • ');
        schedule.textContent = [medication.dosage, routeAndCondition].filter(Boolean).join(' • ');
        const instructions = document.createElement('p');
        instructions.textContent = `Instructions: ${medication.instructions || 'Enter the instructions on the prescription'}`;
        const reminder = document.createElement('p');
        reminder.textContent = medication.time
            ? `Daily reminder: ${medication.time}`
            : 'Daily reminder: Not set';
        const reminderControls = document.createElement('div');
        reminderControls.className = 'reminder-controls';
        const editTimeButton = document.createElement('button');
        editTimeButton.type = 'button';
        editTimeButton.className = 'btn edit-time-btn';
        editTimeButton.textContent = 'Edit time';
        editTimeButton.setAttribute('aria-label', `Edit reminder time for ${medication.name}`);
        editTimeButton.addEventListener('click', () => {
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = getReminderTime(medication.time) || '';
            timeInput.setAttribute('aria-label', `Daily reminder time for ${medication.name}`);

            const saveTimeButton = document.createElement('button');
            saveTimeButton.type = 'button';
            saveTimeButton.className = 'btn save-time-btn';
            saveTimeButton.textContent = 'Save';
            const saveReminderTime = () => {
                const normalizedTime = getReminderTime(timeInput.value);
                if (timeInput.value && !normalizedTime) {
                    alert('Enter a valid reminder time.');
                    timeInput.focus();
                    return;
                }

                medication.time = normalizedTime || '';
                renderMedications();
                checkMedicationReminders();
            };
            saveTimeButton.addEventListener('click', saveReminderTime);
            timeInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveReminderTime();
                }
            });

            const cancelTimeButton = document.createElement('button');
            cancelTimeButton.type = 'button';
            cancelTimeButton.className = 'btn cancel-time-btn';
            cancelTimeButton.textContent = 'Cancel';
            cancelTimeButton.addEventListener('click', renderMedications);

            reminderControls.replaceChildren(timeInput, saveTimeButton, cancelTimeButton);
            timeInput.focus();
        });
        reminderControls.append(reminder, editTimeButton);
        details.append(name, schedule, instructions, reminderControls);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn remove-med-btn';
        removeButton.setAttribute('aria-label', `Remove ${medication.name}`);
        removeButton.dataset.medId = medication.id;
        removeButton.style.color = '#ef4444';
        removeButton.style.padding = '0.25rem 0.5rem';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'trash-2');
        removeButton.appendChild(icon);
        removeButton.addEventListener('click', () => removeMed(medication.id));

        item.append(details, removeButton);
        list.appendChild(item);
    });

    populateMedicationSuggestions();
    try {
        localStorage.setItem('drPill_DB', JSON.stringify(medications));
    } catch (error) {
        console.warn('Unable to save medication data to localStorage.', error);
    }
    updateDashboardReminder();
    createIcons();
}

// Add a new medication (form submission)
function addMedication(event) {
    event.preventDefault();

    const name = document.getElementById('medName').value.trim();
    const dosage = document.getElementById('medDosage').value.trim();
    const time = document.getElementById('medTime').value;
    const route = document.getElementById('medRoute').value.trim();
    const condition = document.getElementById('medCondition').value.trim();
    const instructions = document.getElementById('medInstructions').value.trim();

    if (!name || !dosage || !route || !condition || !instructions) {
        alert('Complete the medication details and enter the directions from the prescription.');
        return;
    }

    medications.push({
        id: nextMedicationId++,
        name,
        dosage,
        route,
        condition,
        instructions,
        time
    });
    renderMedications();

    document.getElementById('addMedForm').reset();
    document.getElementById('addMedForm').reset();
    alert(`Prescription for ${name} added to the local medication list.`);
}

// Remove a medication
function removeMed(id) {
    medications = medications.filter(medication => medication.id !== id);
    renderMedications();
}

// Mark the displayed dose as completed
function markDoseTaken() {
    const button = document.getElementById('takeDoseBtn');
    if (!button) return;

    button.textContent = 'Completed for Today';
    button.style.background = '#15803d';
    button.disabled = true;
}

function updateDashboardReminder() {
    const title = document.getElementById('nextDoseTitle');
    const subtitle = document.getElementById('nextDoseSub');
    const tag = document.getElementById('nextDoseTag');
    const button = document.getElementById('takeDoseBtn');
    const nextDoseDetails = document.getElementById('nextDoseDetails');
    const upcomingDoseList = document.getElementById('upcomingDoseList');
    if (!title || !subtitle || !tag || !button) return;

    const now = new Date();
    const scheduled = medications
        .map(medication => ({ medication, time: getReminderTime(medication.time) }))
        .filter(item => item.time)
        .map(item => {
            const [hours, minutes] = item.time.split(':').map(Number);
            const due = new Date(now);
            due.setHours(hours, minutes, 0, 0);
            if (due <= now) due.setDate(due.getDate() + 1);
            return { ...item, due };
        })
        .sort((first, second) => first.due - second.due)
        .filter(item => item.due.getTime() <= now.getTime() + 24 * 60 * 60 * 1000);

    if (upcomingDoseList) {
        upcomingDoseList.textContent = '';
        if (scheduled.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'upcoming-empty';
            emptyMessage.textContent = 'No upcoming reminders. Add a time from your prescription.';
            upcomingDoseList.appendChild(emptyMessage);
        } else {
            scheduled.forEach(item => {
                const entry = document.createElement('article');
                entry.className = 'upcoming-dose';

                const time = document.createElement('time');
                time.className = 'upcoming-dose-time';
                time.dateTime = item.due.toISOString();
                time.textContent = item.due.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const details = document.createElement('div');
                details.className = 'upcoming-dose-details';
                const name = document.createElement('h3');
                name.textContent = item.medication.name;
                const prescriptionDetails = document.createElement('p');
                prescriptionDetails.textContent = [
                    item.medication.dosage,
                    item.medication.route,
                    item.medication.condition
                ].filter(Boolean).join(' • ');
                const instructions = document.createElement('p');
                instructions.className = 'upcoming-dose-instructions';
                instructions.textContent = `Prescription directions: ${item.medication.instructions || 'Not entered'}`;

                const day = document.createElement('span');
                day.className = 'upcoming-dose-day';
                day.textContent = item.due.toDateString() === now.toDateString() ? 'Today' : 'Tomorrow';
                details.append(name, prescriptionDetails, instructions);
                entry.append(time, details, day);
                upcomingDoseList.appendChild(entry);
            });
        }
    }

    button.disabled = false;
    button.style.background = '';
    if (scheduled.length === 0) {
        tag.textContent = 'REMINDER STATUS';
        title.textContent = 'No dose reminders set';
        subtitle.textContent = 'Set a reminder time from your prescription.';
        if (nextDoseDetails) nextDoseDetails.textContent = '';
        button.textContent = 'Set Reminder Times';
        button.onclick = () => switchTab('medications');
        return;
    }

    const next = scheduled[0];
    const nextDueGroup = scheduled.filter(item => item.due.getTime() === next.due.getTime());
    tag.textContent = 'NEXT DOSE';
    title.textContent = nextDueGroup.length > 1
        ? `${nextDueGroup.length} prescriptions due`
        : next.medication.name;
    subtitle.textContent = `${next.due.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    })} • ${next.due.toDateString() === now.toDateString() ? 'Today' : 'Tomorrow'}`;
    if (nextDoseDetails) {
        nextDoseDetails.textContent = '';
        nextDueGroup.forEach(item => {
            const detail = document.createElement('li');
            detail.textContent = [
                item.medication.name,
                item.medication.dosage,
                item.medication.route,
                item.medication.instructions
            ].filter(Boolean).join(' • ');
            nextDoseDetails.appendChild(detail);
        });
    }
    button.textContent = 'Mark as Taken';
    button.onclick = markDoseTaken;
}

function stopCamera() {
    cameraRequestId += 1;
    if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
        streamRef = null;
    }

    const video = document.getElementById('webcam');
    const placeholder = document.getElementById('scannerPlaceholder');
    const startButton = document.getElementById('startCamBtn');
    const scanButton = document.getElementById('captureScanBtn');
    const laser = document.getElementById('scanLaser');
    const scanResult = document.getElementById('scanResult');

    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (startButton) startButton.classList.remove('hidden');
    if (scanButton) {
        scanButton.classList.add('hidden');
        scanButton.disabled = false;
    }
    if (laser) laser.classList.add('hidden');
    if (scanResult) scanResult.classList.add('hidden');
}

// CAMERA SCANNER LOGIC (demo result; no medicine recognition is performed)
async function startCamera() {
    const video = document.getElementById('webcam');
    const placeholder = document.getElementById('scannerPlaceholder');
    const startButton = document.getElementById('startCamBtn');
    const scanButton = document.getElementById('captureScanBtn');
    const laser = document.getElementById('scanLaser');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera access is not available in this browser or page context.');
        return;
    }

    const requestId = ++cameraRequestId;
    startButton.disabled = true;
    let cameraStream;

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        if (requestId !== cameraRequestId) {
            cameraStream.getTracks().forEach(track => track.stop());
            return;
        }

        streamRef = cameraStream;
        video.srcObject = cameraStream;
        await video.play();
        if (requestId !== cameraRequestId) return;

        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        startButton.classList.add('hidden');
        scanButton.classList.remove('hidden');
        laser.classList.remove('hidden');
    } catch (error) {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        if (streamRef === cameraStream) {
            streamRef = null;
            video.srcObject = null;
        }
        if (requestId === cameraRequestId) {
            console.error('Unable to start the device camera.', error);
            alert('Unable to start the camera. Check browser permissions and try again.');
        }
    } finally {
        startButton.disabled = false;
    }
}

function captureAndScan() {
    if (!streamRef || !streamRef.active) {
        alert('Open the camera before scanning.');
        return;
    }

    const scanResult = document.getElementById('scanResult');
    const laser = document.getElementById('scanLaser');
    const scanButton = document.getElementById('captureScanBtn');
    scanButton.disabled = true;
    laser.style.background = '#3b82f6';

    setTimeout(() => {
        laser.style.background = '#22c55e';
        scanResult.classList.remove('hidden');
        scanResult.scrollIntoView({ behavior: 'smooth' });
        scanButton.disabled = false;
    }, 1200);
}

function addScannedMed() {
    medications.push({
        id: nextMedicationId++,
        name: 'Levocetirizine Dihydrochloride',
        dosage: '1 Tablet (5mg)',
        route: 'Oral tablet',
        condition: '',
        instructions: 'Enter the instructions on the prescription',
        time: ''
    });

    renderMedications();
    alert('Demo Levocetirizine result added to your medication list.');
    switchTab('medications');
}

function getReminderTime(value) {
    if (!value) return null;
    const match = value.match(/^\s*(?:daily\s+at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3] && match[3].toUpperCase();

    if (minutes > 59) return null;
    if (meridiem) {
        if (hours < 1 || hours > 12) return null;
        hours = hours % 12 + (meridiem === 'PM' ? 12 : 0);
    } else if (hours > 23) {
        return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function showDoseReminder(medication) {
    const toast = document.getElementById('reminderToast');
    const message = document.getElementById('reminderToastMessage');
    const reminderDetails = `${medication.name} — ${medication.dosage}`;
    message.textContent = `Time to take your prescription: ${reminderDetails}.`;
    toast.classList.remove('hidden');
    speakDoseReminder([medication], startReminderBeeping);

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification(`Doctor Pill: ${medication.name}`, {
                body: `Time to take ${medication.dosage}.`
            });
            activeDoseNotifications.add(notification);
            notification.onclose = () => {
                activeDoseNotifications.delete(notification);
                if (activeDoseNotifications.size === 0 && reminderBeepIntervalId !== null) {
                    dismissReminder();
                }
            };
        } catch (error) {
            console.warn('Unable to show a browser notification; the in-app reminder is visible.', error);
            document.getElementById('reminderStatus').textContent =
                'The in-app reminder is visible, but the browser notification could not be shown.';
        }
    } else if ('Notification' in window && Notification.permission === 'denied') {
        document.getElementById('reminderStatus').textContent =
            'Browser notifications are blocked. In-app reminders work while this app is open.';
    }
}

function dismissReminder() {
    document.getElementById('reminderToast').classList.add('hidden');
    reminderSpeechRunId += 1;
    if (reminderBeepIntervalId !== null) {
        window.clearInterval(reminderBeepIntervalId);
        reminderBeepIntervalId = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    activeDoseNotifications.forEach(notification => notification.close());
    activeDoseNotifications.clear();
}

function prepareReminderAudio() {
    if (!('AudioContext' in window)) return;

    try {
        if (!reminderAudioContext || reminderAudioContext.state === 'closed') {
            reminderAudioContext = new AudioContext();
        }
        if (reminderAudioContext.state === 'suspended') {
            reminderAudioContext.resume().catch(error => {
                console.warn('Unable to enable reminder audio.', error);
            });
        }
    } catch (error) {
        console.warn('Unable to initialize reminder audio.', error);
    }
}

function playReminderBeep() {
    if (!reminderAudioContext || reminderAudioContext.state !== 'running') return;

    const oscillator = reminderAudioContext.createOscillator();
    const gain = reminderAudioContext.createGain();
    const startTime = reminderAudioContext.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, startTime);
    oscillator.frequency.setValueAtTime(660, startTime + 0.18);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
    gain.gain.setValueAtTime(0.12, startTime + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.38);
    oscillator.connect(gain);
    gain.connect(reminderAudioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.39);
}

function startReminderBeeping() {
    prepareReminderAudio();
    if (!('AudioContext' in window)) {
        document.getElementById('soundStatus').textContent =
            'Beeping reminders are not supported in this browser.';
        return;
    }
    if (reminderBeepIntervalId !== null) return;

    playReminderBeep();
    reminderBeepIntervalId = window.setInterval(playReminderBeep, 2000);
}

function speakDoseReminder(dueMedications, onComplete) {
    if (!reminderVoiceEnabled) {
        onComplete();
        return;
    }

    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        document.getElementById('soundStatus').textContent =
            'Voice reminders are not supported in this browser.';
        onComplete();
        return;
    }

    const medicationList = dueMedications
        .map(medication => `${medication.name}, ${medication.dosage}`)
        .join('. ');
    const speechText = `It is time to take ${medicationList}.`;
    const speechRunId = ++reminderSpeechRunId;
    window.speechSynthesis.cancel();
    let repetitions = 0;

    const speakNextRepetition = () => {
        if (speechRunId !== reminderSpeechRunId || !reminderVoiceEnabled) return;

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = document.documentElement.lang || 'en';
        utterance.rate = 0.95;
        utterance.onend = () => {
            repetitions += 1;
            if (repetitions < 5) speakNextRepetition();
            else if (speechRunId === reminderSpeechRunId) onComplete();
        };
        utterance.onerror = error => {
            console.warn('Unable to play the spoken medication reminder.', error);
            document.getElementById('soundStatus').textContent =
                'The spoken reminder could not be played. Check your device sound settings.';
            if (speechRunId === reminderSpeechRunId) onComplete();
        };
        window.speechSynthesis.speak(utterance);
    };

    speakNextRepetition();
}

function testReminderSound() {
    const status = document.getElementById('soundStatus');
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        status.textContent = 'Voice reminders are not supported in this browser.';
        return;
    }

    reminderVoiceEnabled = true;
    reminderSpeechRunId += 1;
    updateReminderSoundControls();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
        'Voice reminders are on. I will tell you when it is time to take your medication.'
    );
    utterance.lang = document.documentElement.lang || 'en';
    utterance.rate = 0.95;
    utterance.onend = () => {
        status.textContent = 'Voice reminders are on and ready.';
    };
    utterance.onerror = error => {
        console.warn('Unable to play the voice reminder test.', error);
        status.textContent = 'Could not play the voice test. Check your device sound settings.';
    };
    window.speechSynthesis.speak(utterance);
    status.textContent = 'Playing voice reminder test…';
}

function toggleReminderSound() {
    reminderVoiceEnabled = !reminderVoiceEnabled;
    if (!reminderVoiceEnabled && 'speechSynthesis' in window) {
        reminderSpeechRunId += 1;
        window.speechSynthesis.cancel();
    }
    updateReminderSoundControls();
}

function updateReminderSoundControls() {
    const button = document.getElementById('soundToggleBtn');
    const status = document.getElementById('soundStatus');
    if (!button || !status) return;

    button.textContent = `Voice reminder: ${reminderVoiceEnabled ? 'On' : 'Off'}`;
    button.setAttribute('aria-pressed', String(reminderVoiceEnabled));
    status.textContent = reminderVoiceEnabled
        ? 'Voice reminders repeat 5 times. The alarm beeps every 2 seconds until dismissed. Keep this app open and your device sound on.'
        : 'Voice reminders are off. The alarm still beeps every 2 seconds until dismissed.';
}

function checkMedicationReminders() {
    if (!isSignedIn) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let firstDueMedication = null;
    medications.forEach(medication => {
        const reminderTime = getReminderTime(medication.time);
        const reminderKey = `${medication.id}:${today}:${reminderTime}`;
        if (reminderTime === currentTime && !remindedMedicationDates.has(reminderKey)) {
            remindedMedicationDates.add(reminderKey);
            firstDueMedication = firstDueMedication || medication;
        }
    });

    if (firstDueMedication) {
        showDoseReminder(firstDueMedication);
    }
}

function enableReminders() {
    const status = document.getElementById('reminderStatus');
    const button = document.getElementById('enableRemindersBtn');

    if (!('Notification' in window)) {
        status.textContent = 'Browser notifications are not supported here. In-app reminders still work while this app is open.';
        button.disabled = true;
        return;
    }

    if (Notification.permission === 'granted') {
        status.textContent = 'Browser notifications are enabled. Keep this app open for scheduled reminders.';
        return;
    }

    if (Notification.permission === 'denied') {
        status.textContent = 'Browser notifications are blocked. Allow them in your browser settings; in-app reminders work while this app is open.';
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            status.textContent = 'Browser notifications are enabled. Keep this app open for scheduled reminders.';
            button.textContent = 'Notifications enabled';
        } else {
            status.textContent = 'Notifications were not enabled. In-app reminders still work while this app is open.';
        }
    }).catch(error => {
        console.error('Unable to request notification permission.', error);
        status.textContent = 'Could not enable browser notifications. In-app reminders still work while this app is open.';
    });
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    populateMedicationSuggestions();
    renderMedications();
    updateDashboardReminder();
    updateReminderSoundControls();
    if ('Notification' in window && Notification.permission === 'granted') {
        document.getElementById('reminderStatus').textContent =
            'Browser notifications are enabled. Keep this app open for scheduled reminders.';
        document.getElementById('enableRemindersBtn').textContent = 'Notifications enabled';
    } else if ('Notification' in window && Notification.permission === 'denied') {
        document.getElementById('reminderStatus').textContent =
            'Browser notifications are blocked. In-app reminders work while this app is open.';
    }
    checkMedicationReminders();
    window.setInterval(() => {
        checkMedicationReminders();
        updateDashboardReminder();
    }, 15000);
});
