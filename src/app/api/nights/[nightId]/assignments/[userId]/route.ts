import { handleLedgerRequest } from '../../../../../../server/ledger-runtime.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ nightId: string; userId: string }> }): Promise<Response> {
  const { nightId, userId } = await context.params;
  return handleLedgerRequest('revoke-assignment', request, nightId, userId);
}
