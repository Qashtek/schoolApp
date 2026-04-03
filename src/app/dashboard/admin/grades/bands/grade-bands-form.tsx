'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type GradeBandLevel = 'JUNIOR' | 'SENIOR';

type GradeBand = {
  letter: string;
  minScore: number;
  maxScore: number;
};

type GradeBandInputRow = {
  letter: string;
  minScore: string;
  maxScore: string;
};

type GradeBandsFormProps = {
  initialBands: Record<GradeBandLevel, GradeBand[]>;
};

function toInputRows(bands: GradeBand[]): GradeBandInputRow[] {
  return bands.map((band) => ({
    letter: band.letter,
    minScore: String(band.minScore),
    maxScore: String(band.maxScore),
  }));
}

function normalizeRows(rows: GradeBandInputRow[]): GradeBand[] {
  return rows
    .map((row) => ({
      letter: row.letter.trim().toUpperCase(),
      minScore: Number(row.minScore),
      maxScore: Number(row.maxScore),
    }))
    .filter((row) => row.letter.length > 0);
}

export default function GradeBandsForm({ initialBands }: GradeBandsFormProps) {
  const router = useRouter();
  const [juniorRows, setJuniorRows] = useState<GradeBandInputRow[]>(toInputRows(initialBands.JUNIOR));
  const [seniorRows, setSeniorRows] = useState<GradeBandInputRow[]>(toInputRows(initialBands.SENIOR));
  const [savingLevel, setSavingLevel] = useState<GradeBandLevel | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const getRows = (level: GradeBandLevel): GradeBandInputRow[] =>
    level === 'JUNIOR' ? juniorRows : seniorRows;

  const setRows = (level: GradeBandLevel, rows: GradeBandInputRow[]) => {
    if (level === 'JUNIOR') {
      setJuniorRows(rows);
      return;
    }

    setSeniorRows(rows);
  };

  const handleRowChange = (
    level: GradeBandLevel,
    index: number,
    field: keyof GradeBandInputRow,
    value: string
  ) => {
    const rows = getRows(level);
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(level, next);
  };

  const handleAddRow = (level: GradeBandLevel) => {
    setRows(level, [...getRows(level), { letter: '', minScore: '', maxScore: '' }]);
  };

  const handleRemoveRow = (level: GradeBandLevel, index: number) => {
    const rows = getRows(level);
    if (rows.length <= 1) {
      return;
    }

    setRows(level, rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleSave = async (level: GradeBandLevel) => {
    setSuccessMessage('');
    setErrorMessage('');
    setSavingLevel(level);

    try {
      const payload = {
        level,
        bands: normalizeRows(getRows(level)),
      };

      if (payload.bands.length === 0) {
        throw new Error('At least one grade band is required');
      }

      const response = await fetch('/api/grade-bands', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save grade bands');
      }

      setSuccessMessage(`Saved ${level.toLowerCase()} grade bands successfully.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save grade bands');
    } finally {
      setSavingLevel(null);
    }
  };

  const renderBandTable = (level: GradeBandLevel) => {
    const rows = getRows(level);

    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{level} Grade Bands</h2>
            <p className="text-sm text-gray-500">
              Configure score ranges and letters for {level.toLowerCase()} classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleAddRow(level)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add Band
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Grade
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Min Score
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Max Score
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, index) => (
                <tr key={`${level}-${index}`}>
                  <td className="px-3 py-2">
                    <input
                      value={row.letter}
                      onChange={(event) =>
                        handleRowChange(level, index, 'letter', event.target.value.toUpperCase())
                      }
                      className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="A"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.minScore}
                      onChange={(event) =>
                        handleRowChange(level, index, 'minScore', event.target.value)
                      }
                      className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.maxScore}
                      onChange={(event) =>
                        handleRowChange(level, index, 'maxScore', event.target.value)
                      }
                      className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="100"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(level, index)}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={rows.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave(level)}
            disabled={savingLevel === level}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingLevel === level ? 'Saving...' : `Save ${level} Bands`}
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      ) : null}

      {renderBandTable('JUNIOR')}
      {renderBandTable('SENIOR')}
    </div>
  );
}
