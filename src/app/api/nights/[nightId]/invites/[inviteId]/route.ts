import { handleLedgerRequest } from '../../../../../../server/ledger-runtime.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ nightId: string; inviteId: string }> }): Promise<Response> {
  const { nightId, inviteId } = await context.params;
  return handleLedgerRequest('revoke-invite', request, nightId, inviteId);
}
