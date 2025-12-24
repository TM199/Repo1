import { NextRequest, NextResponse } from 'next/server';
import { searchCompanies, getCompanyDetails, getCompanyOfficers } from '@/lib/companies-house';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const companyNumber = searchParams.get('companyNumber');

  if (!query && !companyNumber) {
    return NextResponse.json(
      { error: 'Provide query (company name) or companyNumber' },
      { status: 400 }
    );
  }

  try {
    // If company number provided, get details + officers
    if (companyNumber) {
      const [detailsResult, officersResult] = await Promise.all([
        getCompanyDetails(companyNumber),
        getCompanyOfficers(companyNumber),
      ]);

      return NextResponse.json({
        company: detailsResult.company,
        officers: officersResult.officers,
        error: detailsResult.error || officersResult.error,
      });
    }

    // Otherwise search by name
    const result = await searchCompanies(query!, 20);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Labs/Companies House] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
