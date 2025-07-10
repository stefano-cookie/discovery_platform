import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { residenceSchema, ResidenceForm } from '../../../utils/validation';
import Input from '../../UI/Input';
import Button from '../../UI/Button';

interface ResidenceStepProps {
  data: Partial<ResidenceForm>;
  onNext: (data: ResidenceForm) => void;
  onBack: () => void;
}

const ResidenceStep: React.FC<ResidenceStepProps> = ({ data, onNext, onBack }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<ResidenceForm>({
    resolver: zodResolver(residenceSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const hasDifferentDomicilio = useWatch({
    control,
    name: 'hasDifferentDomicilio',
  });

  const onSubmit = (formData: ResidenceForm) => {
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Residenza</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Input
              label="Via/Indirizzo *"
              {...register('residenzaVia')}
              error={errors.residenzaVia?.message}
            />
          </div>

          <Input
            label="Città *"
            {...register('residenzaCitta')}
            error={errors.residenzaCitta?.message}
          />

          <Input
            label="Provincia *"
            {...register('residenzaProvincia')}
            error={errors.residenzaProvincia?.message}
          />

          <Input
            label="CAP *"
            {...register('residenzaCap')}
            error={errors.residenzaCap?.message}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="hasDifferentDomicilio"
            {...register('hasDifferentDomicilio')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="hasDifferentDomicilio" className="ml-2 block text-sm text-gray-900">
            Il domicilio è diverso dalla residenza
          </label>
        </div>

        {hasDifferentDomicilio && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Domicilio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Input
                  label="Via/Indirizzo *"
                  {...register('domicilioVia')}
                  error={errors.domicilioVia?.message}
                />
              </div>

              <Input
                label="Città *"
                {...register('domicilioCitta')}
                error={errors.domicilioCitta?.message}
              />

              <Input
                label="Provincia *"
                {...register('domicilioProvincia')}
                error={errors.domicilioProvincia?.message}
              />

              <Input
                label="CAP *"
                {...register('domicilioCap')}
                error={errors.domicilioCap?.message}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
        >
          Indietro
        </Button>
        
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

export default ResidenceStep;