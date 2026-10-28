import { requireRole } from "@/lib/auth-guard";
import { getSuperAdminUsers } from "@/lib/user-management-service";
import CredentialDirectoryClient from "@/components/super-admin/CredentialDirectoryClient";

export default async function SuperAdminAdminsPage() {
  const session = await requireRole(["SUPER_ADMIN"], "/login");

  const result = await getSuperAdminUsers(
    { role: "ADMIN", page: 1, limit: 25 },
    session
  );

  return (
    <CredentialDirectoryClient
      initialUsers={result.users}
      totalCount={result.totalCount}
      initialPage={result.page}
      totalPages={result.totalPages}
      currentAdminId={session.userId}
      defaultRoleFilter="ADMIN"
      titleSuffix="— Administrators"
    />
  );
}
