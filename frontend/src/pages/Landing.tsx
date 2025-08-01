import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/UI/Button';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-medium tracking-tight text-slate-900 sm:text-7xl">
            Piattaforma{' '}
            <span className="relative whitespace-nowrap text-blue-600">
              <span className="relative">Diamante</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-700">
            La piattaforma di formazione professionale che ti accompagna nel tuo percorso di crescita.
          </p>
          <p className="mt-4 text-sm text-green-600 font-semibold">
            ✅ Deploy Test - {new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}
          </p>
          <div className="mt-10 flex justify-center gap-x-6">
            <Link to="/registration">
              <Button size="lg">
                Inizia Ora
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Accedi
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white mx-auto">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Corsi Professionali</h3>
              <p className="mt-2 text-gray-600">
                Accedi a corsi di alta qualità progettati per il tuo sviluppo professionale.
              </p>
            </div>

            <div className="text-center mt-8 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white mx-auto">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Rete di Partner</h3>
              <p className="mt-2 text-gray-600">
                Unisciti alla nostra rete di partner e guadagna con il sistema di commissioni.
              </p>
            </div>

            <div className="text-center mt-8 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white mx-auto">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Certificazioni</h3>
              <p className="mt-2 text-gray-600">
                Ottieni certificazioni riconosciute che valorizzano il tuo CV.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;