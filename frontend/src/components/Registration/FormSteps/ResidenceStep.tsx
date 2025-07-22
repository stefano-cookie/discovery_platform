import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { residenceSchema, ResidenceForm } from '../../../utils/validation';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { getItalianProvinceOptions } from '../../../services/geoService';

interface ResidenceStepProps {
  data: Partial<ResidenceForm>;
  onNext: (data: ResidenceForm) => void;
  onChange?: (data: Partial<ResidenceForm>) => void;
}

const ResidenceStep: React.FC<ResidenceStepProps> = ({ data, onNext, onChange }) => {
  const [provinceOptions] = useState(getItalianProvinceOptions());
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ResidenceForm>({
    resolver: zodResolver(residenceSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const hasDifferentDomicilio = useWatch({
    control,
    name: 'hasDifferentDomicilio',
  });



  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      if (onChange) {
        onChange(value as Partial<ResidenceForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

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

          <Select
            label="Provincia *"
            options={provinceOptions}
            {...register('residenzaProvincia')}
            error={errors.residenzaProvincia?.message as string}
            placeholder="Seleziona provincia"
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

              <Select
                label="Provincia *"
                options={provinceOptions}
                {...register('domicilioProvincia')}
                error={errors.domicilioProvincia?.message as string}
                placeholder="Seleziona provincia"
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

      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-blue-800 text-sm">
              Il domicilio è necessario solo se diverso dalla residenza. Inserisci solo indirizzi italiani.
            </p>
          </div>
        </div>
      </div>

    </form>
  );
};

export default ResidenceStep;