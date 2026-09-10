import { getSupabase } from '../db';

export interface AccountMember {
  id: string;
  account_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

export class SharedAccountService {
  // Add a member to an account (only owner can do this)
  async addMember(accountId: string, ownerId: string, userId: string, role: 'member' = 'member'): Promise<AccountMember> {
    const supabase = getSupabase();
    // Verify that the ownerId is indeed the owner of the account
    const { data: ownerCheck, error: ownerError } = await supabase
      .from('accounts')
      .select('owner_id')
      .eq('id', accountId)
      .single();
    if (ownerError) throw ownerError;
    if (!ownerCheck || ownerCheck.owner_id !== ownerId) {
      throw new Error('Only the account owner can add members');
    }
    const { data, error } = await supabase
      .from('account_members')
      .insert({
        account_id: accountId,
        user_id: userId,
        role,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Remove a member from an account (owner can remove any member; member can remove themselves)
  async removeMember(accountId: string, requesterId: string, userIdToRemove: string): Promise<void> {
    const supabase = getSupabase();
    // Check if requester is owner or the user themselves
    const { data: memberData, error: memberError } = await supabase
      .from('account_members')
      .select('role, user_id')
      .eq('account_id', accountId)
      .eq('user_id', userIdToRemove)
      .single();
    if (memberError) throw memberError;
    const isOwnerCheck = await supabase
      .from('accounts')
      .select('owner_id')
      .eq('id', accountId)
      .single();
    if (isOwnerCheck.error) throw isOwnerCheck.error;
    const isOwner = isOwnerCheck.data?.owner_id === requesterId;
    const isSelf = userIdToRemove === requesterId;
    if (!isOwner && !isSelf) {
      throw new Error('Only the account owner or the member themselves can remove membership');
    }
    const { error } = await supabase
      .from('account_members')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userIdToRemove);
    if (error) throw error;
  }

  // List members of an account (owner or member can view)
  async listMembers(accountId: string, requesterId: string): Promise<AccountMember[]> {
    const supabase = getSupabase();
    // Verify requester has access to the account (owner or member)
    const { data: accessData, error: accessError } = await supabase
      .from('account_members')
      .select('user_id, role')
      .eq('account_id', accountId)
      .eq('user_id', requesterId)
      .single();
    if (accessError && accessError.code !== 'PGRST116') throw accessError;
    const hasAccess = !!accessData;
    // Also check if requester is owner
    const { data: ownerData, error: ownerError } = await supabase
      .from('accounts')
      .select('owner_id')
      .eq('id', accountId)
      .single();
    if (ownerError) throw ownerError;
    const isOwner = ownerData?.owner_id === requesterId;
    if (!hasAccess && !isOwner) {
      throw new Error('Access denied to this account');
    }
    const { data, error } = await supabase
      .from('account_members')
      .select('*')
      .eq('account_id', accountId);
    if (error) throw error;
    return data ?? [];
  }

  // Get accounts that a user has access to (owned or member)
  async getUserAccounts(userId: string): Promise<any[]> {
    const supabase = getSupabase();
    // Get accounts where user is owner
    const { data: ownedAccounts, error: ownedError } = await supabase
      .from('accounts')
      .select('*')
      .eq('owner_id', userId);
    if (ownedError) throw ownedError;
    // Get accounts where user is a member
    const { data: memberAccounts, error: memberError } = await supabase
      .from('account_members')
      .select('accounts(*)')
      .eq('user_id', userId);
    if (memberError) throw memberError;
    const members = memberAccounts?.map(m => m.accounts) ?? [];
    // Combine and deduplicate by id
    const all = [...(ownedAccounts ?? []), ...members];
    const seen = new Set();
    const unique = all.filter(acc => {
      if (seen.has(acc.id)) return false;
      seen.add(acc.id);
      return true;
    });
    return unique;
  }
}
