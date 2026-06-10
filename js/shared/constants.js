/** Shared constants ported from extract_csv.py */

export const QUESTIONS_METADATA_API_URL = 'https://qms-api.nagwa.com/v1/questions/metadata';
export const QUESTIONS_METADATA_API_MAX_RETRIES = 3;
export const QUESTIONS_METADATA_API_RETRY_DELAY_SEC = 2;
export const QUESTIONS_METADATA_API_TIMEOUT_SEC = 30;

export const SHEETS_SPREADSHEET_ID = '1Qc9LrE54LyDzAB1sAyK6iBJDJUbT1Y3sh9-7MNSm85M';
export const SHEETS_TEMP_TAB_NAME = 'temp';

export const SLIDE_FIELDS = [
  'slide_id', 'question_id', 'question_placement',
  'required_correct', 'attempt_window', 'homework', 'section_gp',
  'video_id', 'video_title', 'timestamp', 'activity_id', 'verbatim', 'verbatim_listening',
];

export const HEADER_FIELDS = [
  'metasession_id', 'metasession_number', 'metasession_type',
  'grade', 'term', 'subject', 'language', 'country',
  'numerals', 'duration',
];

export const NEW_MODE_SLIDE_FIELDS = [
  'slide_id', 'section_id', 'question_id', 'question_role',
  'required_correct', 'attempt_window', 'section_gp',
  'video_id', 'video_title', 'timestamp', 'activity_id', 'verbatim', 'verbatim_listening',
  'section_title', 'slide_title', 'section_type',
];

export const SECTION_ID_TAGS = new Set(['section_id']);

export const VALID_QUESTION_ROLES = [
  'interactive_example', 'interactive example', 'example', 'checkpoint', 'practice',
];

export const THANK_YOU_PATTERNS = [
  'thank you', 'شكرًا جزيلًا', 'شكرا جزيلًا', 'شكرًا جزيلا', 'شكرا جزيلا',
];

export const THANK_YOU_STANDARDIZED = {
  'thank you': 'Thank You!',
  'شكرًا جزيلًا': 'شكرًا جزيلًا',
};

export const SECTION_TITLE_TARGET_RGB = [0, 114, 180];

export const REQUIRED_SECTION_TITLES_FOR_QID = [
  'مثال', 'سؤال', 'example', 'Example', 'question', 'Question',
  'essempio', 'domanda', 'ejemplo', 'bregunta', 'beispiel', 'frage',
  'Essempio', 'Domanda', 'Ejemplo', 'Pregunta', 'Beispiel', 'Frage',
];

/** xml_builder.py configuration */
export const ID_URL = 'https://12digit.nagwa.com/get.bulk.codes/1/cps/cps.system/';

export const SUBJECTS_REQUIRING_TRANSLATION = new Set([
  'الأحياء', 'اكتشف', 'العلوم', 'العلوم المتكاملة', 'الرياضيات',
  'الرياضيات • القسم الأدبي', 'الإحصاء', 'الكيمياء', 'الفيزياء',
]);

export const QMS_QUESTION_TRANSLATION_URL = 'https://qms-api.nagwa.com/v1/questions/translations';
export const QMS_QUESTION_TRANSLATION_LANGUAGE = 'ar';
export const QMS_QUESTION_TRANSLATION_BATCH_SIZE = 100;
export const QMS_QUESTION_TRANSLATION_TIMEOUT_SEC = 30;
export const QMS_QUESTION_TRANSLATION_MAX_RETRIES = 3;
export const QMS_QUESTION_TRANSLATION_RETRY_DELAY_SEC = 2;

export const QMS_QUESTION_METADATA_URL = QUESTIONS_METADATA_API_URL;
export const QMS_QUESTION_METADATA_BATCH_SIZE = 100;
export const QMS_QUESTION_METADATA_TIMEOUT_SEC = QUESTIONS_METADATA_API_TIMEOUT_SEC;
export const QMS_QUESTION_METADATA_MAX_RETRIES = QUESTIONS_METADATA_API_MAX_RETRIES;
export const QMS_QUESTION_METADATA_RETRY_DELAY_SEC = QUESTIONS_METADATA_API_RETRY_DELAY_SEC;
