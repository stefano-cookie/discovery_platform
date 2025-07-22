import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { educationSchema, EducationForm } from '../../../utils/validation';
import { getCoursesByType } from '../../../data/courses';
import { getUniversityOptions } from '../../../data/universities';
import Input from '../../UI/Input';
import Select from '../../UI/Select';

interface EducationStepProps {
  data: Partial<EducationForm>;
  onNext: (data: EducationForm) => void;
  onChange?: (data: Partial<EducationForm>) => void;
}

const EducationStep: React.FC<EducationStepProps> = ({ data, onNext, onChange }) => {
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  // Watch the degree type to update available courses
  const selectedDegreeType = useWatch({
    control,
    name: 'tipoLaurea',
  });

  // Local state to handle course selection (needed for custom onChange)
  const [selectedCourse, setSelectedCourse] = useState(data.laureaConseguita || '');
  const [selectedTriennaleCourse, setSelectedTriennaleCourse] = useState(data.laureaConseguitaTriennale || '');

  // Get available courses based on selected degree type
  const availableCourses = useMemo(() => {
    if (!selectedDegreeType) return [];
    return getCoursesByType(selectedDegreeType);
  }, [selectedDegreeType]);

  // Get university options
  const universityOptions = useMemo(() => {
    return getUniversityOptions();
  }, []);

  // Get available courses for triennale
  const availableTriennaleCourses = useMemo(() => {
    return getCoursesByType('Triennale');
  }, []);

  // Reset course selection when degree type changes
  useEffect(() => {
    if (selectedDegreeType && selectedCourse) {
      const coursesForType = getCoursesByType(selectedDegreeType);
      if (!coursesForType.includes(selectedCourse)) {
        setSelectedCourse('');
        setValue('laureaConseguita', '');
      }
    }
  }, [selectedDegreeType, setValue, selectedCourse]);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      if (onChange) {
        onChange(value as Partial<EducationForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const onSubmit = (formData: EducationForm) => {
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Titolo di Studio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo di Laurea *
            </label>
            <select
              {...register('tipoLaurea')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleziona il tipo di laurea</option>
              <option value="Magistrale">Laurea Magistrale (LM)</option>
              <option value="Magistrale a ciclo unico">Laurea Magistrale a ciclo unico (LMU)</option>
              <option value="Vecchio ordinamento">Laurea Magistrale vecchio ordinamento</option>
            </select>
            {errors.tipoLaurea && (
              <p className="mt-1 text-sm text-red-600">{errors.tipoLaurea.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Corso di Laurea Conseguito *
            </label>
{selectedDegreeType ? (
              <>
                <select
                  {...register('laureaConseguita')}
                  value={selectedCourse}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  onChange={(e) => {
                    setSelectedCourse(e.target.value);
                    setValue('laureaConseguita', e.target.value);
                  }}
                >
                  <option value="">Seleziona il corso di laurea</option>
                  {availableCourses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                
              </>
            ) : (
              <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500">
                Prima seleziona il tipo di laurea
              </div>
            )}
            {errors.laureaConseguita && (
              <p className="mt-1 text-sm text-red-600">{errors.laureaConseguita.message}</p>
            )}
            {selectedDegreeType && availableCourses.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {availableCourses.length} corsi disponibili per {selectedDegreeType}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Select
              label="Università *"
              options={universityOptions}
              {...register('laureaUniversita')}
              error={errors.laureaUniversita?.message as string}
              placeholder="Seleziona università"
            />
          </div>

          <div>
            <Input
              label="Data Conseguimento Laurea *"
              type="date"
              {...register('laureaData')}
              error={errors.laureaData?.message}
            />
          </div>
        </div>
      </div>

      {/* Sezione triennale condizionale per lauree magistrali */}
      {selectedDegreeType === 'Magistrale' && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Laurea Triennale Precedente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo di Laurea Triennale *
              </label>
              <select
                {...register('tipoLaureaTriennale')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona il tipo di laurea triennale</option>
                <option value="Triennale">Laurea Triennale (L)</option>
                <option value="Diploma universitario">Diploma Universitario</option>
                <option value="Altro">Altro</option>
              </select>
              {errors.tipoLaureaTriennale && (
                <p className="mt-1 text-sm text-red-600">{errors.tipoLaureaTriennale.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corso di Laurea Triennale Conseguito *
              </label>
              <select
                {...register('laureaConseguitaTriennale')}
                value={selectedTriennaleCourse}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                onChange={(e) => {
                  setSelectedTriennaleCourse(e.target.value);
                  setValue('laureaConseguitaTriennale', e.target.value);
                }}
              >
                <option value="">Seleziona il corso di laurea triennale</option>
                {availableTriennaleCourses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
              {errors.laureaConseguitaTriennale && (
                <p className="mt-1 text-sm text-red-600">{errors.laureaConseguitaTriennale.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Select
                label="Università Triennale *"
                options={universityOptions}
                {...register('laureaUniversitaTriennale')}
                error={errors.laureaUniversitaTriennale?.message as string}
                placeholder="Seleziona università triennale"
              />
            </div>

            <div>
              <Input
                label="Data Conseguimento Laurea Triennale *"
                type="date"
                {...register('laureaDataTriennale')}
                error={errors.laureaDataTriennale?.message}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-orange-800 text-sm">
              📚 Inserisci il titolo di studio più alto conseguito. {selectedDegreeType === 'Magistrale' ? 'I dati della laurea triennale sono obbligatori.' : 'Sarà necessario allegare il certificato nel passaggio successivo.'}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EducationStep;