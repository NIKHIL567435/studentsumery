mermaid.initialize({ startOnLoad: true });

// --- Crucial: Ensure elements are hidden on page load ---
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('qaLoadingMessage').style.display = 'none';
    document.querySelector('.download-options').style.display = 'none';
});
// --------------------------------------------------------

async function uploadDocument() {
    const fileInput = document.getElementById('documentUpload');
    const file = fileInput.files[0];
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');
    const downloadOptionsDiv = document.querySelector('.download-options');

    if (!file) {
        errorMessage.textContent = 'Please select a file to upload.';
        return;
    }

    // Clear previous results and ensure elements are hidden before showing loading
    errorMessage.textContent = '';
    resultsContainer.innerHTML = '<p>Upload a PDF or text file to get started and see the magic happen!</p>';
    downloadOptionsDiv.style.display = 'none';
    loadingMessage.style.display = 'flex';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('summary_points', document.getElementById('summaryPoints').value);
    formData.append('num_concepts', document.getElementById('numConcepts').value);
    formData.append('num_quiz_questions', document.getElementById('numQuizQuestions').value);
    formData.append('num_flashcards', document.getElementById('numFlashcards').value);

    // Append checkbox states
    formData.append('include_summary', document.getElementById('includeSummary').checked);
    formData.append('include_key_concepts', document.getElementById('includeKeyConcepts').checked);
    formData.append('include_topic_outline', document.getElementById('includeTopicOutline').checked);
    formData.append('include_quiz_questions', document.getElementById('includeQuizQuestions').checked);
    formData.append('include_flashcards', document.getElementById('includeFlashcards').checked);
    formData.append('include_key_takeaways', document.getElementById('includeKeyTakeaways').checked);
    formData.append('include_mind_map', document.getElementById('includeMindMap').checked);

    try {
        const response = await fetch('/summarize', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            displayResults(data);
        } else {
            errorMessage.textContent = data.error || 'An unknown error occurred during summarization.';
        }
    } catch (error) {
        errorMessage.textContent = 'Network error or API issue: ' + error.message + '. Please try again.';
    } finally {
        loadingMessage.style.display = 'none';
    }
}

async function askQuestion() {
    const userQuestionInput = document.getElementById('userQuestion');
    const userQuestion = userQuestionInput.value.trim();
    const qaLoadingMessage = document.getElementById('qaLoadingMessage');
    const qaErrorMessage = document.getElementById('qaErrorMessage');
    const qaAnswer = document.getElementById('qaAnswer');

    if (!userQuestion) {
        qaErrorMessage.textContent = 'Please enter a question.';
        return;
    }

    qaErrorMessage.textContent = '';
    qaAnswer.textContent = '';
    qaLoadingMessage.style.display = 'flex';

    try {
        const response = await fetch('/ask_question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userQuestion })
        });

        const data = await response.json();

        if (response.ok) {
            qaAnswer.textContent = data.answer;
        } else {
            qaErrorMessage.textContent = data.error || 'An unknown error occurred while getting the answer.';
        }
    } catch (error) {
        qaErrorMessage.textContent = 'Network error or API issue: ' + error.message + '. Please try again.';
    } finally {
        qaLoadingMessage.style.display = 'none';
    }
}

function displayResults(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    const downloadOptionsDiv = document.querySelector('.download-options');
    resultsContainer.innerHTML = ''; // Clear previous results

    // Show download options after results are displayed
    downloadOptionsDiv.style.display = 'block'; // Or 'flex' if you prefer

    // Helper to check if a checkbox was checked
    const isSectionSelected = (id) => document.getElementById(id).checked;

    // 1. Summary
    if (isSectionSelected('includeSummary') && data.summary && data.summary.length > 0) {
        let summaryHtml = '<h3>📘 Summary</h3><ul>';
        data.summary.forEach(point => {
            summaryHtml += `<li>${point}</li>`;
        });
        summaryHtml += '</ul>';
        resultsContainer.innerHTML += summaryHtml;
    }

    // 2. Key Concepts
    if (isSectionSelected('includeKeyConcepts') && data.key_concepts && data.key_concepts.length > 0) {
        let conceptsHtml = '<h3>🧠 Key Concepts & Definitions</h3><ul>';
        data.key_concepts.forEach(concept => {
            conceptsHtml += `<li><b>${concept.term}:</b> ${concept.explanation}</li>`;
        });
        conceptsHtml += '</ul>';
        resultsContainer.innerHTML += conceptsHtml;
    }

    // 3. Topic-Wise Outline (Optional)
    if (isSectionSelected('includeTopicOutline') && data.topic_outline && data.topic_outline.length > 0) {
        let outlineHtml = '<h3>📋 Topic-Wise Outline</h3><table><thead><tr><th>Topic</th><th>Description</th><th>Importance</th></tr></thead><tbody>';
        data.topic_outline.forEach(item => {
            outlineHtml += `<tr><td>${item.topic}</td><td>${item.description}</td><td>${item.importance}</td></tr>`;
        });
        outlineHtml += '</tbody></table>';
        resultsContainer.innerHTML += outlineHtml;
    }

    // 4. Quiz Questions
    if (isSectionSelected('includeQuizQuestions') && data.quiz_questions && data.quiz_questions.length > 0) {
        let quizHtml = '<h3>❓ Quiz Questions</h3><ol>';
        data.quiz_questions.forEach((q, index) => {
            quizHtml += `<li><b>Question ${index + 1}:</b> ${q.question}<br>`;
            q.options.forEach(option => {
                quizHtml += `&nbsp;&nbsp;${option}<br>`;
            });
            quizHtml += `✅ <b>Answer:</b> ${q.answer}`;
            if (q.reason) { // Display reason if available
                quizHtml += `<br><i>Reason: ${q.reason}</i>`;
            }
            quizHtml += `</li>`;
        });
        quizHtml += '</ol>';
        resultsContainer.innerHTML += quizHtml;
    }

    // 5. Flashcards
    if (isSectionSelected('includeFlashcards') && data.flashcards && data.flashcards.length > 0) {
        let flashcardsHtml = '<h3>🧠 Flashcards</h3><div class="flashcard-grid">';
        data.flashcards.forEach((card, index) => {
            flashcardsHtml += `
                <div class="flashcard" onclick="this.classList.toggle('flipped')">
                    <div class="flashcard-inner">
                        <div class="flashcard-front">${card.front}</div>
                        <div class="flashcard-back">${card.back}</div>
                    </div>
                </div>
            `;
        });
        flashcardsHtml += '</div>';
        resultsContainer.innerHTML += flashcardsHtml;
    }

    // 6. Key Takeaways (Optional)
    if (isSectionSelected('includeKeyTakeaways') && data.key_takeaways && data.key_takeaways.length > 0) {
        let takeawaysHtml = '<h3>📌 Key Takeaways</h3><ul>';
        data.key_takeaways.forEach(takeaway => {
            takeawaysHtml += `<li>${takeaway}</li>`;
        });
        takeawaysHtml += '</ul>';
        resultsContainer.innerHTML += takeawaysHtml;
    }

    // 7. Mind Map (Optional)
    if (isSectionSelected('includeMindMap') && data.mind_map_mermaid) {
        resultsContainer.innerHTML += `<h3>💡 Mind Map</h3><div class="mermaid">${data.mind_map_mermaid}</div>`;
        mermaid.init(undefined, resultsContainer.querySelectorAll('.mermaid'));
    }
}

// New function to download all results as plain text
function downloadPlainText() {
    const resultsContainer = document.getElementById('resultsContainer');
    // Clone the container to manipulate its content without affecting the displayed HTML
    const tempDiv = resultsContainer.cloneNode(true);

    // Remove non-content elements like H3 tags and format lists for plain text
    let plainTextContent = "";
    Array.from(tempDiv.children).forEach(child => {
        if (child.tagName === 'H3') {
            plainTextContent += child.textContent + "\n\n";
        } else if (child.tagName === 'UL') {
            Array.from(child.children).forEach(li => {
                plainTextContent += "- " + li.textContent + "\n";
            });
            plainTextContent += "\n";
        } else if (child.tagName === 'OL') {
            Array.from(child.children).forEach((li, index) => {
                plainTextContent += (index + 1) + ". " + li.textContent + "\n";
            });
            plainTextContent += "\n";
        } else if (child.tagName === 'PRE') {
            plainTextContent += child.textContent + "\n\n";
        } else if (child.tagName === 'TABLE') {
            // Basic table to plain text conversion
            let tableText = '';
            const headers = Array.from(child.querySelectorAll('thead th')).map(th => th.textContent);
            tableText += headers.join('\t');
            tableText += '\n';
            Array.from(child.querySelectorAll('tbody tr')).forEach(row => {
                const rowData = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
                tableText += rowData.join('\t') + '\n';
            });
            plainTextContent += tableText + "\n\n";
        } else if (child.classList.contains('mermaid')) {
            // Exclude Mermaid diagrams from plain text download
            // plainTextContent += child.textContent + "\n\n";
        }
    });
    
    const blob = new Blob([plainTextContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'study_pack.txt';
    link.click();
    URL.revokeObjectURL(link.href);
} 