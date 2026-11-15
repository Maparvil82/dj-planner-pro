-- Read-only queries for the project owner through the database administration tools.
-- No client-side key or public user role is granted access to other users' answers.
select survey_version, language, count(*) as responses
from public.research_survey_responses group by survey_version,language order by survey_version,language;

-- Separate the respondent profiles; do not mix prospective and active freelancers.
select answers->>'profile' as profile, count(*) as responses
from public.research_survey_responses group by 1 order by 2 desc;

-- Multiple priorities: a respondent contributes to each selected feature.
select answers->>'profile' as profile, feature, count(*) as respondents
from public.research_survey_responses
cross join lateral jsonb_array_elements_text(answers->'priorities') as feature
where survey_version='self-employed-djs-v1' group by 1,2 order by 3 desc;

-- Single main priority, including automatic resolution of a one-feature selection.
select answers->>'first' as feature, count(*) as respondents
from public.research_survey_responses
where survey_version='self-employed-djs-v1' and answers ? 'first'
group by 1 order by 2 desc;

-- Original-language comments; account IDs and contact details are not needed here.
select language, answers->>'recent' as recent_difficulty,
 answers->>'toolsOther' as other_tool, answers->>'prioritiesOther' as other_priority,
 answers->>'additional' as additional_comment
from public.research_survey_responses where survey_version='self-employed-djs-v1'
order by submitted_at;
