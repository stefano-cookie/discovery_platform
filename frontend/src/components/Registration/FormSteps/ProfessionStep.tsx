import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { professionSchema, ProfessionForm } from '../../../utils/validation';
import Input from '../../UI/Input';

interface ProfessionStepProps {
  data: Partial<ProfessionForm>;
  onNext: (data: ProfessionForm) => void;
  onChange?: (data: Partial<ProfessionForm>) => void;
}

const ProfessionStep: React.FC<ProfessionStepProps> = ({ data, onNext, onChange }) => {
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<ProfessionForm>({
    resolver: zodResolver(professionSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  // Watch profession type to show/hide school fields
  const selectedProfessionType = useWatch({
    control,
    name: 'tipoProfessione',
  });
  
  // Ensure tipoProfessione changes are propagated to parent immediately
  useEffect(() => {
    if (selectedProfessionType && onChange) {
      onChange({ tipoProfessione: selectedProfessionType });
    }
  }, [selectedProfessionType, onChange]);

  // Check if profession type requires school information
  const requiresSchoolInfo = selectedProfessionType === 'Docente di ruolo' || selectedProfessionType === 'Docente a tempo determinato';

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      if (onChange) {
        onChange(value as Partial<ProfessionForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const onSubmit = (formData: ProfessionForm) => {
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Situazione Professionale</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo di Professione *
            </label>
            <select
              {...register('tipoProfessione', {
                onChange: (e) => {
                  const value = e.target.value;
                  if (onChange) {
                    onChange({ tipoProfessione: value });
                  }
                }
              })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleziona la tua situazione professionale</option>
              <option value="Docente di ruolo">Docente di ruolo</option>
              <option value="Docente a tempo determinato">Docente a tempo determinato</option>
              <option value="Altro">Altro</option>
            </select>
            {errors.tipoProfessione && (
              <p className="mt-1 text-sm text-red-600">{errors.tipoProfessione.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Campi scuola (solo per insegnanti/docenti) */}
      {requiresSchoolInfo && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Informazioni Istituto Scolastico</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Input
                label="Denominazione Scuola/Istituto"
                placeholder="es. Liceo Scientifico Galileo Galilei"
                {...register('scuolaDenominazione')}
                error={errors.scuolaDenominazione?.message}
              />
            </div>

            <Input
              label="Città"
              placeholder="es. Roma"
              {...register('scuolaCitta')}
              error={errors.scuolaCitta?.message}
            />

            <Input
              label="Provincia"
              placeholder="es. RM"
              {...register('scuolaProvincia')}
              error={errors.scuolaProvincia?.message}
            />
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-blue-800 text-sm">
              💼 Le informazioni professionali ci aiutano a personalizzare la tua esperienza formativa e le opportunità di carriera.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ProfessionStep;