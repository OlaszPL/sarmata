import { Notice } from '@sarmata/ui';

export function RoleNotice({ area }: { area: string }) {
  return (
    <Notice tone="info" title="Ta część jest dla kadr">
      Twoja rola nie daje dostępu do: {area}. Jeśli potrzebujesz tych danych, poproś o nie kadry
      urzędu.
    </Notice>
  );
}
