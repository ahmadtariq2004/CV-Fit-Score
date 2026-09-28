import json
import re

import requests
from django.conf import settings

WEIGHTS = {
    'technical_skills_score': 0.35,
    'experience_score': 0.25,
    'responsibility_score': 0.15,
    'education_score': 0.10,
    'projects_certifications_score': 0.10,
    'keyword_score': 0.05,
}

REQUIRED_FIELDS = {
    *WEIGHTS,
    'matching_skills', 'missing_skills', 'experience_match', 'education_match',
    'strengths', 'weaknesses', 'suggestions', 'summary',
}

PROMPT_TEMPLATE = '''You are a careful CV-to-job matching analyst. Compare the CV to the job description and assess relevance to this specific role, not the person's worth.

Return ONLY one valid JSON object, with no markdown fences and no commentary. Use integer scores from 0 to 100 for each scoring field. Use concise strings and arrays of strings.

Required JSON fields:
- technical_skills_score, experience_score, responsibility_score, education_score, projects_certifications_score, keyword_score
- matching_skills, missing_skills, experience_match, education_match
- strengths, weaknesses, suggestions, summary

Score using these weights: technical skills 35%, experience 25%, responsibilities 15%, education 10%, projects/certifications 10%, other keywords 5%. The backend will calculate the final weighted score from your component scores.

JOB DESCRIPTION:
{job_description}

CV TEXT:
{cv_text}
'''


class QwenServiceError(RuntimeError):
    pass


def _extract_json(content):
    cleaned = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
    fenced = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, flags=re.DOTALL | re.IGNORECASE)
    candidate = fenced.group(1) if fenced else cleaned[cleaned.find('{'):cleaned.rfind('}') + 1]
    if not candidate:
        raise ValueError('No JSON object returned')
    return json.loads(candidate)


def _as_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()][:12]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalise(result):
    if not isinstance(result, dict) or not REQUIRED_FIELDS.issubset(result):
        raise ValueError('The AI response is missing required fields')
    normalised = {}
    for field in WEIGHTS:
        try:
            normalised[field] = max(0, min(100, int(float(result[field]))))
        except (TypeError, ValueError) as exc:
            raise ValueError('The AI returned an invalid score') from exc
    for field in ('matching_skills', 'missing_skills', 'strengths', 'weaknesses', 'suggestions'):
        normalised[field] = _as_list(result[field])
    for field in ('experience_match', 'education_match', 'summary'):
        value = str(result[field]).strip()
        if not value:
            raise ValueError('The AI returned an empty explanation')
        normalised[field] = value[:2000]
    normalised['overall_score'] = round(sum(normalised[field] * weight for field, weight in WEIGHTS.items()))
    return normalised


def analyze(job_description, cv_text):
    payload = {
        'model': settings.QWEN_MODEL,
        'prompt': PROMPT_TEMPLATE.format(job_description=job_description[:12000], cv_text=cv_text),
        'stream': False,
        'format': 'json',
        'options': {'temperature': 0.1},
    }
    try:
        response = requests.post(f'{settings.QWEN_BASE_URL.rstrip("/")}/api/generate', json=payload, timeout=settings.QWEN_TIMEOUT)
        response.raise_for_status()
        content = response.json().get('response', '')
        return _normalise(_extract_json(content))
    except requests.RequestException as exc:
        raise QwenServiceError(f'Qwen is unavailable at {settings.QWEN_BASE_URL}. Start Ollama and load the configured model.') from exc
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise QwenServiceError('Qwen returned an invalid analysis. Please try again.') from exc
