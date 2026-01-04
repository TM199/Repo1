import { inngest } from '../client';
import { classifyCompany } from '@/agents/agency-classifier-agent';
import { createAdminClient } from '@/lib/supabase/server';
import { activityLogger } from '@/lib/activity-logger';

export const classifyCompaniesFunction = inngest.createFunction(
  {
    id: 'classify-companies-batch',
    throttle: { limit: 10, period: '1m' }, // 10 per minute (API cost control)
    retries: 3,
  },
  { event: 'company/classify.requested' },
  async ({ event, step }) => {
    const { companyIds } = event.data;
    const supabase = createAdminClient();

    const results = [];

    for (const companyId of companyIds) {
      // Step 1: Get company data
      const company = await step.run(`get-company-${companyId}`, async () => {
        const { data } = await supabase
          .from('companies')
          .select('id, name, domain, companies_house_number')
          .eq('id', companyId)
          .single();
        return data;
      });

      if (!company) continue;

      // Step 2: Classify company
      const classification = await step.run(`classify-${companyId}`, async () => {
        return await classifyCompany(company.name, {
          domain: company.domain,
          useTools: true,
        });
      });

      // Step 3: Update database
      await step.run(`save-${companyId}`, async () => {
        await supabase
          .from('companies')
          .update({
            is_recruitment_agency: classification.isRecruitmentAgency,
            agency_confidence: classification.confidence,
            agency_reasoning: classification.reasoning,
            agency_classified_at: new Date().toISOString(),
            agency_classification_source: 'ai',
          })
          .eq('id', companyId);
      });

      results.push({ companyId, ...classification });
    }

    // Log activity for dashboard feed
    if (results.length > 0) {
      const agencyCount = results.filter(r => r.isRecruitmentAgency).length;
      await activityLogger.classificationComplete(results.length, agencyCount);
    }

    return { classified: results.length, results };
  }
);
