import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { generalDataSchema, GeneralDataForm } from '../../../utils/validation';
import Input from '../../UI/Input';
import Button from '../../UI/Button';

interface GeneralDataStepProps {
  data: Partial<GeneralDataForm>;
  onNext: (data: GeneralDataForm) => void;
}

const GeneralDataStep: React.FC<GeneralDataStepProps> = ({ data, onNext }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<GeneralDataForm>({
    resolver: zodResolver(generalDataSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const onSubmit = (formData: GeneralDataForm) => {
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Email *"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />

        <Input
          label="Telefono *"
          type="tel"
          {...register('telefono')}
          error={errors.telefono?.message}
        />

        <Input
          label="Cognome *"
          {...register('cognome')}
          error={errors.cognome?.message}
        />

        <Input
          label="Nome *"
          {...register('nome')}
          error={errors.nome?.message}
        />

        <Input
          label="Data di Nascita *"
          type="date"
          {...register('dataNascita')}
          error={errors.dataNascita?.message}
        />

        <Input
          label="Luogo di Nascita *"
          {...register('luogoNascita')}
          error={errors.luogoNascita?.message}
        />

        <Input
          label="Codice Fiscale *"
          {...register('codiceFiscale')}
          error={errors.codiceFiscale?.message}
          className="uppercase"
        />

        <div></div>

        <Input
          label="Nome del Padre"
          {...register('nomePadre')}
          error={errors.nomePadre?.message}
        />

        <Input
          label="Nome della Madre"
          {...register('nomeMadre')}
          error={errors.nomeMadre?.message}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isValid}
        >
          Avanti
        </Button>
      </div>
    </form>
  );
};

export default GeneralDataStep;