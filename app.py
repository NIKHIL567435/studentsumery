import os
from flask import Flask, request, render_template, jsonify, session
import google.generativeai as genai
from pypdf import PdfReader
from docx import Document # Import Document for .docx processing
import json

app = Flask(__name__)
app.secret_key = os.urandom(24) # Set a secret key for session management

# Configure Google Gemini API
genai.configure(api_key="AIzaSyAzWWdYUXukXlpNYrAREGSmiudsNOWCRxo")
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    text_content = ""
    if file:
        if file.filename.endswith('.pdf'):
            reader = PdfReader(file)
            for page in reader.pages:
                text_content += page.extract_text() or ""
        elif file.filename.endswith('.txt'):
            text_content = file.read().decode('utf-8')
        elif file.filename.endswith('.docx'): # Handle .docx files
            document = Document(file)
            for paragraph in document.paragraphs:
                text_content += paragraph.text + "\n"
        else:
            return jsonify({'error': 'Unsupported file type. Please upload a PDF, TXT, or DOCX file.'}), 400

    if not text_content:
        print("DEBUG: text_content is empty.")
        return jsonify({'error': 'Could not extract text from the provided file.'}), 400

    print(f"DEBUG: Extracted text length: {len(text_content)}")
    print(f"DEBUG: First 200 chars: {text_content[:200]}")

    # Store text_content in session for follow-up questions
    session['extracted_text'] = text_content

    # Get customization parameters from the request, with default values
    summary_points = request.form.get('summary_points', type=int, default=5)
    num_concepts = request.form.get('num_concepts', type=int, default=5)
    num_quiz_questions = request.form.get('num_quiz_questions', type=int, default=5)
    num_flashcards = request.form.get('num_flashcards', type=int, default=5)

    # Get section inclusion parameters from the request
    include_summary = request.form.get('include_summary') == 'true'
    include_key_concepts = request.form.get('include_key_concepts') == 'true'
    include_topic_outline = request.form.get('include_topic_outline') == 'true'
    include_quiz_questions = request.form.get('include_quiz_questions') == 'true'
    include_flashcards = request.form.get('include_flashcards') == 'true'
    include_key_takeaways = request.form.get('include_key_takeaways') == 'true'
    include_mind_map = request.form.get('include_mind_map') == 'true'

    prompt_parts = [
        f"""
        You are a smart AI-powered study assistant for students. Your task is to take academic content (text or extracted from a document), and output a well-organized, structured study pack that includes summaries, concepts, quizzes, and flashcards.

        **Important:** Your entire response MUST be a valid JSON object. Do not include any text outside the JSON object. The JSON should have the following keys:
        - "summary": An array of strings, each a bullet point summary (exactly {summary_points} bullet points).
        - "key_concepts": An array of objects, each with "term" and "explanation" keys (exactly {num_concepts}).
        - "topic_outline": (Optional) An array of objects, each with "topic", "description", and "importance" keys. If not suitable, provide an empty array.
        - "quiz_questions": An array of objects, each with "question", "options" (an array of strings), and "answer" (the correct option, e.g., "a") keys (exactly {num_quiz_questions} MCQs).
        - "flashcards": An array of objects, each with "front" and "back" keys (exactly {num_flashcards} flashcards).
        - "key_takeaways": (Optional) An array of strings, each representing a powerful takeaway (3-5 bullet points). If not suitable, provide an empty array.
        - "mind_map_mermaid": (Optional) A string containing the Mermaid.js graph definition for a mind map of the summarized notes. If not suitable, provide an empty string.

        Follow the details of the structured output format for each section within the JSON values:

        """
    ]

    if include_summary:
        prompt_parts.append(f"""
        📘 **1. Summary (in {summary_points} bullet points)**
        - Summarize the core concepts, topics, and learning objectives covered in the content.
        - Use concise academic language.

        **Format (within JSON):**
        - An array of strings, each a bullet point summary.

        ---

        """)
    else:
        # Ensure summary is an empty array if not included
        pass # Logic for handling empty summary in JSON will be handled after response

    if include_key_concepts:
        prompt_parts.append(f"""
        🧠 **2. Key Concepts & Definitions (exactly {num_concepts})**
        List and define important concepts, terms, or topics the student should know.

        **Format (within JSON):**
        - "term": "Term goes here", "explanation": "Short, clear explanation in 1–2 lines."

        ---

        """)
    else:
        pass

    if include_topic_outline:
        prompt_parts.append(f"""
        📋 **3. Topic-Wise Outline or Table (optional)**
        If the content includes multiple topics, structure them into a table with Topic Name, Description, and Importance.

        **Format (within JSON):**
        - "topic": "Topic Name", "description": "What it covers", "importance": "Why it's useful"

        (If content is not suitable for table format, skip this section or provide an empty array for "topic_outline".)

        ---

        """)
    else:
        pass

    if include_quiz_questions:
        prompt_parts.append(f"""
        ❓ **4. Quiz Questions (exactly {num_quiz_questions} MCQs with answers)**
        Design {num_quiz_questions} quiz questions with **clear multiple-choice options**, the correct answer marked, and a **reason** for the answer.
        Use varying difficulty levels: 2 easy, 2 medium, 1 hard.

        **Format (within JSON):**
        - "question": "...", "options": ["a) ...", "b) ...", "c) ...", "d) ..."], "answer": "b", "reason": "Explanation for why 'b' is correct."

        ---

        """)
    else:
        pass

    if include_flashcards:
        prompt_parts.append(f"""
        🧠 **5. Flashcards (exactly {num_flashcards})**
        Create digital flashcards in this format:

        **Format (within JSON):**
        - "front": "Concept / Term", "back": "1–2 sentence explanation."

        Ensure the flashcards are beginner-friendly, useful for spaced repetition.

        ---

        """)
    else:
        pass

    if include_key_takeaways:
        prompt_parts.append(f"""
        📌 **6. Key Takeaways (optional)**
        Summarize 3-5 powerful takeaways students should remember long-term.

        **Format (within JSON):**
        - An array of strings, each a bullet point takeaway.

        ---

        """)
    else:
        pass

    if include_mind_map:
        prompt_parts.append(f"""
        💡 **7. Mind Map (Optional)**
        Generate a Mermaid.js graph definition (using `graph TD` or `graph LR` syntax for a simple flow chart or mind map) that visualizes the main concepts and their relationships from the summarized notes. Ensure the diagram is valid Mermaid syntax. If not suitable, provide an empty string.

        **Format (within JSON):**
        "mind_map_mermaid": "graph TD; A-->B;"

        ---

        """)
    else:
        pass

    # Add the content section at the very end
    prompt_parts.append(f"""
    -----Content:
    {text_content}
    """)

    try:
        response = model.generate_content(prompt_parts)
        # Clean the response text by removing markdown code block fences
        cleaned_response_text = response.text.strip()
        if cleaned_response_text.startswith('```json') and cleaned_response_text.endswith('```'):
            cleaned_response_text = cleaned_response_text[len('```json'):-len('```')].strip()

        summary_results_json = json.loads(cleaned_response_text)

        # Ensure all expected keys are present, even if not generated by AI
        if not include_summary: summary_results_json['summary'] = []
        if not include_key_concepts: summary_results_json['key_concepts'] = []
        if not include_topic_outline: summary_results_json['topic_outline'] = []
        if not include_quiz_questions: summary_results_json['quiz_questions'] = []
        if not include_flashcards: summary_results_json['flashcards'] = []
        if not include_key_takeaways: summary_results_json['key_takeaways'] = []
        if not include_mind_map: summary_results_json['mind_map_mermaid'] = ""

        return jsonify(summary_results_json)
    except json.JSONDecodeError as e:
        print(f"JSON decoding error: {e}")
        print(f"AI Response (raw): {response.text}")
        return jsonify({'error': 'Failed to parse AI response. Invalid JSON.'}), 500
    except Exception as e:
        return jsonify({'error': f'AI summarization failed: {str(e)}'}), 500

@app.route('/ask_question', methods=['POST'])
def ask_question():
    user_question = request.json.get('question')
    extracted_text = session.get('extracted_text')

    if not user_question:
        return jsonify({'error': 'No question provided.'}), 400
    if not extracted_text:
        return jsonify({'error': 'No document content found. Please upload a document first.'}), 400

    qa_prompt = [
        f"""
        You are a helpful AI assistant. Based on the following document content, answer the user's question concisely and directly.

        Document Content:
        {extracted_text}

        User Question:
        {user_question}

        Answer:
        """
    ]

    try:
        qa_response = model.generate_content(qa_prompt)
        return jsonify({'answer': qa_response.text})
    except Exception as e:
        return jsonify({'error': f'Failed to get answer from AI: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True) 