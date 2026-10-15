import { Workspace } from '@/components/workspace';
export default function Demo() {
  return (
    <Workspace
      demo
      profile={{ id: 'demo', nome: 'Usuário demonstração', perfil: 'ADMIN' }}
      units={[
        { id: 'demo', nome: 'UPA Rocha Miranda', sigla: 'UPA RM', dias_consumo: 112, endereco: '' },
      ]}
    />
  );
}
