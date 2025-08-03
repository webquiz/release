/* ----------------------------------------------------------------------
 *   webquiz.js | javascript for controlling webquiz web pages
 * -----------------------------------------------------------------------
 *
 *   Copyright (C) Andrew Mathas, University of Sydney
 *
 *   Distributed under the terms of the GNU General Public License (GPL)
 *               http://www.gnu.org/licenses/
 *
 *   This file is part of the WebQuiz system.
 *   <Andrew.Mathas@sydney.edu.au>
 *
 * ----------------------------------------------------------------------
 *   Partly based on earlier code by Donald Taylor
 *   Substantially rewritten for /
 */

// ----------------------------------------------------------------------
// All of the data for the quiz is stored in the WQ object. We wrap the
// data inside a function to make it more difficult to access the data
// from the javascript console.
let WQ = (function () {
    // private data that we do not want to share
    const quiz = {
        answers: [],           // student data
        attempts: [],          // number of times that the question has been attempted
        buttonOrder: [],       // map from button number to question number
        correct: [],           // questions answered correctly
        feedback: true,        // showing feedback
        finishingTime: null,   // time quiz should end
        markingApi: null,      // URL of the API that will receive the results
        onePage: false,        // true if all questions are displayed on a single page
        questionOrder: [],     // map from question number to button number
        questions: [],         // the quiz questions
        store: 'localStorage', // WebQuiz store
        submitted: false,      // record whether we have submitted, so we don't submit twice
    };

    // public methods
    const button = (b) => { return buttonOrder[b] };
    const cannotSet = (prop) => { console.log('WARNING: unable to set ' + prop) };
    const eat = (food) => { for (const [key, value] of Object.entries(read(food))) { quiz[key] = value } };

    // return the public facing data
    return {
        currentB: 0,             // current button number
        currentFeedback: null,   // feedback currently being displayed
        currentQ: 0,             // current question number
        discussions: [],         // the discussions
        quizIndex: [],           // Titles for the quiz index
        quizIndexCreated: false, // stop the dropdown menu from being created twice
        sideMenuOpen: true,      // side menu is open by default

        // getters
        get onePage() { return quiz.onePage },
        get feedback() { return quiz.feedback },
        get finishingTime() { return quiz.finishingTime },
        get markingApi() { return quiz.markingApi },

        // setters : prevent the user from changing internal settings
        set answers(val) { cannotSet('answers') },
        set attempts(val) { cannotSet('attempts') },
        set correct(val) { cannotSet('correct') },
        set feedback(val) { cannotSet('feedback') },
        set finishingTime(val) { cannotSet('finishing time') },
        set markingApi(val) { cannotSet('markingApi') },
        set onePage(val) { cannotSet('onePage') },
        set questions(val) { cannotSet('questions') },

        // other WebQuiz methods that use the private quiz data
        manna: eat,
        button: button,
    }
})()

// ----------------------------------------------------------------------
// Translations
const Words = {
    noMore: 'There are no more unanswered questions',    // string used in alerts
    pleaseAnswer: 'Please answer the question first',    // string used in alerts
}

// ----------------------------------------------------------------------


// create the drop down menu dynamically using the WQ.quizIndex array
function createQuizIndexMenu() {
    if (!WQ.quizIndexCreated) {
        document.getElementById("quizzes-menu-icon").innerHTML = " &#9776;";
        const menu = document.createDocumentFragment();
        let max = 0;

        for (let q = 0; q < WQ.quizIndex.length; q++) {
            const quizLink = document.createElement("li");
            quizLink.innerHTML = `<a href="${WQ.quizIndex[q][1]}">${WQ.quizIndex[q][0]}</a>`;
            menu.appendChild(quizLink);
            max = Math.max(max, WQ.quizIndex[q][0].length);
        }

        WQ.quizIndexMenu.style.width = `${Math.round(max)}ex`;
        WQ.quizIndexMenu.appendChild(menu);
        WQ.quizIndexCreated = true;
    }
}

// create an event listener so that we can close the drop-down menu
// whenever some one clicks outside of it
function MenuEventListener(evnt) {
    const menuIcon = document.getElementById('quizzes-menu-icon');
    if (WQ.quizIndexMenu.contains(evnt.target)) {
        return; // inside the menu so just return
    } else {   // outside the menu so check the number of menu_clicks
        if (WQ.quizIndexMenu.style.display === 'block' || menuIcon.contains(evnt.target)) {
            evnt.stopPropagation();
            toggleQuizIndexMenu();
        }
    }
}

// toggle the display of the side menu that contains the question numbers
function toggleQuizIndexMenu() {
    if (WQ.quizIndexMenu.style.display === 'block') {
        WQ.quizIndexMenu.style.display = 'none';
    } else {
        WQ.quizIndexMenu.style.display = 'block';
        window.addEventListener('click', MenuEventListener, true);
    }
}

// Utility function to toggle display
function toggleDisplay(element, condition) {
    element.style.display = condition ? 'block' : 'none';
}

// show or hide the sidemenu
function showSideMenu() {
    toggleDisplay(WQ.sideMenu, WQ.sideMenuOpen);
    toggleDisplay(WQ.sideOpen, WQ.sideMenuOpen);
    toggleDisplay(WQ.sideClosed, !WQ.sideMenuOpen);
}

// toggle the display of the side menu and its many associated labels
function toggleSideMenu() {
    WQ.sideMenuOpen = !WQ.sideMenuOpen
    showSideMenu()
    // remember whether the side menu is open or closed
    saveQuizData()
}

// ----------------------------------------------------------------------
// ??? implement a dynamic theme switcher
// ??? should be coupled with a drop-down menu as in theme_menu in webquiz_templates
// var theme_menu            // handler for the theme_menu
// function toggleThemeMenu() {// unused
//     if (theme_menu.style.display === 'block') {
//       theme_menu.style.display = 'none';
//     } else {
//       theme_menu.style.display = 'block';
//       window.addEventListener('click', MenuEventListener, true);
//     }
// }

// Code to hide/show questions
function showQuestion(newB, newQ) { // newQ is an integer which is always in the WQ.correct range
    console.log(`showQuestion(${newB}, ${newQ})`);
    if (!WQ.onePage) {
        // hide the current question and feedback
        if (newQ !== WQ.currentQ && WQ.currentQ !== 0) {
            hideFeedback();
            document.getElementById(`question${WQ.currentQ}`).style.display = "none";
            // "de-select" the current button
            WQ.currentB.classList.remove("button-selected");
        }
        // display the new question
        document.getElementById(`question${newQ}`).style.display = "table";

        // update the question/discussion header and select question button
        if (newQ > 0) {
            document.getElementById("question-label").style.display = 'contents';
            document.getElementById("question-number").innerHTML = String(newB);
        } else {
            document.getElementById("question-label").style.display = 'none';
            document.getElementById("question-number").innerHTML = WQ.discussions[-newQ];
        }
        // set WQ.currentB = the current button and "select" the current button
        WQ.currentB = document.getElementById(`button${newB}`);
        WQ.currentB.classList.add("button-selected");
    }

    // finally set WQ.currentQ = current question
    WQ.currentQ = newQ;
}

// ----------------------------------------------------------------------
// Code to hide/show feedback

function hideFeedback() {
    if (WQ.currentFeedback) {
        WQ.currentFeedback.style.display = "none";
    }
}

// show the feedback for the question unless the quiz is timed
function showFeedback(tag) {
    console.log(`showFeedback: tag=${tag}, current feedback=${WQ.currentFeedback}`);
    if (!WQ.finishingTime) {
        hideFeedback(); // hide current feedback
        WQ.currentFeedback = document.getElementById(tag);
        if (WQ.currentFeedback) {
            WQ.currentFeedbackTag = tag;
            WQ.currentFeedback.style.display = "block";
        }
    }
}

// if increment==1 we find the next questions that has not
// been answered incorrectly and if increment==-1 we find the last
// such question
function nextQuestion(increment) {
    console.log(`nextQuestion(${increment})`);
    if (WQ.currentQ < 0) { // a discussion item => go to either first or last question
        if (increment === 1) {
            gotoQuestion(1);
        } else {
            gotoQuestion(WQ.qTotal);
        }
    } else {
        let b = WQ.button(WQ.currentQ), q;
        do {
            b += increment;
            if (b === 0) {
                b = WQ.qTotal;
            } else if (b > WQ.qTotal) {
                b = 1;
            }
            q = WQ.questionOrder[b];
        } while (q !== WQ.currentQ && (!WQ.feedback || WQ.correct[q]));
        if (b === WQ.currentB) {
            alert(Words.noMore);
        } else {
            gotoQuestion(b);
        }
    }
}

// ----------------------------------------------------------------------
// Add error handling for fetch in `submitQuiz`
async function submitQuiz(msg = '') {
    console.log('submitQuiz');
    if (WQ.markingApi && !WQ.submitted && WQ.quizTimer) {
        const now = new Date();
        if (msg && (WQ.finishingTime - now) / 60000 > 2) {
            if (!confirm(msg)) return;
        }

        const headers = ['Student', ...Array.from({ length: WQ.qTotal }, (_, i) => `Q${i + 1}`), 'Total'].join(', ');
        const results = [WQ.studentID, ...WQ.correct.map(c => (c ? 1 : 0)), WQ.correct.filter(Boolean).length].join(', ');

        const data = {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: btoa(JSON.stringify({ quiz: WQ.quizName, ID: WQ.studentID, headers, results })),
        };

        try {
            const response = await fetch(WQ.markingApi, data);
            if (!response.ok) {
                const errorMessage = await response.text();
                alert(`${errorMessage}. Please send ${data.body} to your unit administrator`);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const responseData = await response.json();
            console.log('Success:', responseData.message);
            WQ.submitted = true;

            WQ.finishingTime = now;
            WQ.quizTimer.innerHTML = '';
            document.getElementById('quiz-timer-submit').style.display = "none";
        } catch (error) {
            console.error('Request failed:', error.message);
            alert(`${error.message}. Please send ${data.body} to your unit administrator`);
        }
    }
}

// ----------------------------------------------------------------------
// Specification for the question buttons for use in updateQuestionMarker
const buttons = ['answered', 'blank', 'cross', 'star', 'tick'];
const answered = {
    "content": "",
    "name": "answered"
};
const blank = {
    "content": "",
    "name": "blank"
};
const cross = {
    "content": "\u2718",
    "name": "cross"
};
const star = {
    "content": "\u272D",
    "name": "star"
};
const tick = {
    "content": "\u2714",
    "name": "tick"
};

function updateQuestionMarker(bnum, qnum) {
    // here qnum is assumed to be the question number in the web form
    if (WQ.feedback && qnum > 0) {
        let marker = blank;
        const button = document.getElementById('button' + bnum);
        if (WQ.finishingTime) { // don't update WQ.correct and incorrect markers if timing quiz
            if (WQ.correct[qnum] || WQ.attempts[qnum] > 0) {
                marker = answered;
            }
        } else {
            if (WQ.correct[qnum]) {
                if (WQ.attempts[qnum] === 0) {
                    marker = star;
                } else {
                    marker = tick;
                }
            } else if (WQ.attempts[qnum] > 0) {
                marker = cross;
            }
        }
        for (let b = 0; b < buttons.length; b++) {
            button.classList.remove(buttons[b]);
        }
        button.classList.add(marker.name);
        button.setAttribute("content", marker.content);
    }
}

// ...rest of the code remains unchanged...
