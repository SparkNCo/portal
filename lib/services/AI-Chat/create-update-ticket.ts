'use server';
import { UpdateReponseType } from '@/lib/types/utils/functions-return-type';
import { parseFormData } from '@/utils/helpers';
import { getJiraDefaultValues } from '../jira/get-jira-default-values'; // Mantén esta importación
import { supabase } from '@/lib/supabase/client';

export const createOrUpdateTicket = async (
  formData: FormData
): Promise<UpdateReponseType> => {
  const values = parseFormData(formData, 'values');
  const { id, summary, description, priority } = values;

  const method = id ? 'PUT' : 'POST';

  const body = getJiraDefaultValues({
    method,
    endpoint: id ? `rest/api/3/issue/${id}` : 'rest/api/3/issue',
    summary,
    description,
    priority,
    projectKey: 'TEST',
    issueType: 'Task',
  });
  console.log(body.body);
  // Llamada a la función de Supabase para invocar la función de Jira
  const { data: jiraData, error: jiraError } = await supabase.functions.invoke(
    'jira',
    { body }
  );
  if (jiraError) {
    console.log(jiraError);
    return {
      error:
        'There was an error while executing the function. Please try again later.',
      success: null,
    };
  }

  return {
    error: null,
    success: id
      ? 'Ticket updated successfully!'
      : ' Ticket created successfully!',
  };
};
