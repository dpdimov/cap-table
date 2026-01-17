import React, { useState, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, TrendingUp, Users, DollarSign, X, Edit2, AlertCircle, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Style constants using CSS variables
const styles = {
  bgPrimary: { backgroundColor: 'var(--bg-primary)' },
  bgSecondary: { backgroundColor: 'var(--bg-secondary)' },
  bgTertiary: { backgroundColor: 'var(--bg-tertiary)' },
  textPrimary: { color: 'var(--text-primary)' },
  textSecondary: { color: 'var(--text-secondary)' },
  border: { borderColor: 'var(--border-color)' },
  inputBg: { backgroundColor: 'var(--input-bg)' },
  accent1: { color: 'var(--accent-1)' },
  accent2: { color: 'var(--accent-2)' },
};

const CapTableTool = () => {
  const [foundingShares, setFoundingShares] = useState(1000000);
  const [rounds, setRounds] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [exitValuation, setExitValuation] = useState(50000000);

  // Refs for PDF export
  const capTableRef = useRef(null);
  const exitDistributionRef = useRef(null);

  // PDF export function
  const exportToPDF = async (elementRef, filename) => {
    if (!elementRef.current) return;

    try {
      const element = elementRef.current;

      // Create canvas from the element
      const canvas = await html2canvas(element, {
        backgroundColor: '#1a2332',
        scale: 2,
        logging: false,
        useCORS: true
      });

      // Calculate dimensions
      const imgWidth = 190; // A4 width minus margins (in mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(232, 237, 242);
      pdf.text(filename.replace('.pdf', ''), 10, 15);

      // Add the image
      pdf.addImage(imgData, 'PNG', 10, 25, imgWidth, imgHeight);

      // Save the PDF
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const [newRound, setNewRound] = useState({
    name: '',
    investment: 0,
    preMoneyValuation: 0,
    optionPoolPct: 0,
    optionPoolTiming: 'post', // 'pre' or 'post' money
    liquidationPreference: 1,
    participating: false,
    participationCap: 3,
    antiDilution: 'none', // 'none', 'full-ratchet', 'weighted-average'
    proRataRights: true
  });

  const openAddModal = () => {
    const lastRound = rounds[rounds.length - 1];
    const lastPostMoney = lastRound ? (lastRound.preMoneyValuation + lastRound.investment) : foundingShares * 0.5;

    const roundNumber = rounds.length;
    let roundName = 'Seed';
    if (roundNumber === 0) roundName = 'Pre-Seed';
    else if (roundNumber > 1) roundName = `Series ${String.fromCharCode(64 + roundNumber - 1)}`;

    setNewRound({
      name: roundName,
      investment: Math.round(lastPostMoney * 0.5),
      preMoneyValuation: Math.round(lastPostMoney * 2),
      optionPoolPct: 0,
      optionPoolTiming: 'post',
      liquidationPreference: 1,
      participating: false,
      participationCap: 3,
      antiDilution: 'none',
      proRataRights: true
    });
    setEditingIndex(null);
    setShowAddModal(true);
  };

  const openEditModal = (index) => {
    setNewRound({ ...rounds[index] });
    setEditingIndex(index);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingIndex(null);
  };

  const saveRound = () => {
    if (!newRound.name || newRound.investment <= 0 || newRound.preMoneyValuation <= 0) {
      alert('Please fill in all required fields with valid values');
      return;
    }

    if (editingIndex !== null) {
      const updatedRounds = [...rounds];
      updatedRounds[editingIndex] = { ...newRound };
      setRounds(updatedRounds);
    } else {
      setRounds([...rounds, { ...newRound }]);
    }
    closeModal();
  };

  const removeRound = (index) => {
    setRounds(rounds.filter((_, i) => i !== index));
  };

  const capTableData = useMemo(() => {
    const shareholders = {
      'Founders': {
        shares: foundingShares,
        class: 'Common',
        invested: 0,
        preferences: {}
      },
      'Option Pool': {
        shares: 0,
        class: 'Options',
        invested: 0,
        preferences: {}
      }
    };

    const history = [];
    let totalShares = foundingShares;

    // Initial state
    history.push({
      stage: 'Founding',
      totalShares,
      sharePrice: 0,
      postMoneyValuation: 0,
      shareholders: JSON.parse(JSON.stringify(shareholders)),
      ownership: {
        'Founders': (foundingShares / totalShares) * 100,
        'Option Pool': 0
      },
      roundDetails: null
    });

    // Process each round
    rounds.forEach((round, roundIndex) => {
      let preMoneyShares = totalShares;

      // Handle option pool creation (pre-money if specified)
      let optionPoolShares = 0;
      if (round.optionPoolPct > 0 && round.optionPoolTiming === 'pre') {
        // Calculate option pool as % of post-money including the pool
        // If we want X% pool post-money: pool_shares = (X% * pre_shares) / (1 - X%)
        const poolFraction = round.optionPoolPct / 100;
        optionPoolShares = (poolFraction * preMoneyShares) / (1 - poolFraction);
        shareholders['Option Pool'].shares += optionPoolShares;
        preMoneyShares += optionPoolShares;
      }

      const sharePrice = round.preMoneyValuation / preMoneyShares;
      let newShares = round.investment / sharePrice;

      // Handle anti-dilution adjustments for existing preferred shareholders
      if (roundIndex > 0 && sharePrice < history[history.length - 1].sharePrice) {
        // Down round - apply anti-dilution protection
        Object.keys(shareholders).forEach(name => {
          if (shareholders[name].class === 'Preferred' && shareholders[name].preferences?.antiDilution) {
            const prevPrice = shareholders[name].preferences.originalPrice;

            if (round.antiDilution === 'full-ratchet') {
              // Full ratchet: re-price all previous shares at new lower price
              const additionalShares = shareholders[name].invested / sharePrice - shareholders[name].shares;
              shareholders[name].shares += additionalShares;
              totalShares += additionalShares;
              preMoneyShares += additionalShares;
            } else if (round.antiDilution === 'weighted-average') {
              // Simplified weighted average (broad-based)
              const oldShares = shareholders[name].shares;
              const moneyInvested = shareholders[name].invested;
              const newConversionPrice = (prevPrice * preMoneyShares + round.investment) / (preMoneyShares + newShares);
              const newSharesAfterAdjustment = moneyInvested / newConversionPrice;
              const additionalShares = newSharesAfterAdjustment - oldShares;

              if (additionalShares > 0) {
                shareholders[name].shares += additionalShares;
                totalShares += additionalShares;
                preMoneyShares += additionalShares;
              }
            }
          }
        });

        // Recalculate after anti-dilution adjustments
        newShares = round.investment / sharePrice;
      }

      // Handle pro-rata participation from previous investors
      const proRataAllocations = {};
      if (roundIndex > 0) {
        Object.keys(shareholders).forEach(name => {
          if (shareholders[name].class === 'Preferred' && shareholders[name].preferences?.proRataRights) {
            const currentOwnership = shareholders[name].shares / totalShares;
            const proRataShares = currentOwnership * newShares;
            const proRataInvestment = proRataShares * sharePrice;

            proRataAllocations[name] = {
              shares: proRataShares,
              investment: proRataInvestment,
              ownership: currentOwnership * 100
            };
          }
        });
      }

      // Create investor entry for this round
      const investorName = round.name;
      if (!shareholders[investorName]) {
        shareholders[investorName] = {
          shares: 0,
          class: 'Preferred',
          invested: 0,
          preferences: {
            liquidationPreference: round.liquidationPreference,
            participating: round.participating,
            participationCap: round.participationCap,
            antiDilution: round.antiDilution,
            proRataRights: round.proRataRights,
            originalPrice: sharePrice
          }
        };
      }
      shareholders[investorName].shares = newShares;
      shareholders[investorName].invested = round.investment;

      let postMoneyShares = preMoneyShares + newShares;

      // Handle option pool creation (post-money if specified)
      if (round.optionPoolPct > 0 && round.optionPoolTiming === 'post') {
        optionPoolShares = (round.optionPoolPct / 100) * postMoneyShares;
        shareholders['Option Pool'].shares += optionPoolShares;
        postMoneyShares += optionPoolShares;
      }

      totalShares = postMoneyShares;
      const postMoneyValuation = round.preMoneyValuation + round.investment;

      // Calculate ownership percentages
      const ownership = {};
      Object.keys(shareholders).forEach(name => {
        ownership[name] = (shareholders[name].shares / totalShares) * 100;
      });

      history.push({
        stage: round.name,
        totalShares,
        sharePrice,
        postMoneyValuation,
        investment: round.investment,
        shareholders: JSON.parse(JSON.stringify(shareholders)),
        ownership: { ...ownership },
        roundDetails: {
          optionPoolPct: round.optionPoolPct,
          optionPoolTiming: round.optionPoolTiming,
          optionPoolShares,
          liquidationPreference: round.liquidationPreference,
          participating: round.participating,
          antiDilution: round.antiDilution,
          proRataAllocations
        }
      });
    });

    return history;
  }, [foundingShares, rounds]);

  // Calculate liquidation waterfall
  const liquidationAnalysis = useMemo(() => {
    if (rounds.length === 0) return null;

    const currentData = capTableData[capTableData.length - 1];
    const proceeds = exitValuation;
    const distribution = {};
    let remainingProceeds = proceeds;

    // Initialize distribution
    Object.keys(currentData.shareholders).forEach(name => {
      distribution[name] = 0;
    });

    // Step 1: Pay liquidation preferences to preferred shareholders
    const preferredHolders = Object.keys(currentData.shareholders)
      .filter(name => currentData.shareholders[name].class === 'Preferred')
      .sort((a, b) => {
        // Sort by seniority (later rounds typically have senior preferences)
        const aIndex = rounds.findIndex(r => r.name === a);
        const bIndex = rounds.findIndex(r => r.name === b);
        return bIndex - aIndex; // Reverse order for seniority
      });

    preferredHolders.forEach(name => {
      const shareholder = currentData.shareholders[name];
      const prefs = shareholder.preferences;
      const liquidationAmount = shareholder.invested * (prefs.liquidationPreference || 1);

      if (remainingProceeds >= liquidationAmount) {
        distribution[name] += liquidationAmount;
        remainingProceeds -= liquidationAmount;
      } else {
        distribution[name] += remainingProceeds;
        remainingProceeds = 0;
      }
    });

    // Step 2: Handle participation for participating preferred
    const participatingHolders = preferredHolders.filter(name =>
      currentData.shareholders[name].preferences.participating
    );

    if (participatingHolders.length > 0 && remainingProceeds > 0) {
      // Participating preferred share pro-rata with common
      const participatingShares = participatingHolders.reduce((sum, name) =>
        sum + currentData.shareholders[name].shares, 0
      );
      const commonShares = (currentData.shareholders['Founders']?.shares || 0);
      const totalParticipatingShares = participatingShares + commonShares;

      const proRataDistribution = remainingProceeds;

      participatingHolders.forEach(name => {
        const shareholder = currentData.shareholders[name];
        const proRataShare = (shareholder.shares / totalParticipatingShares) * proRataDistribution;
        const cap = shareholder.preferences.participationCap * shareholder.invested;
        const additionalAmount = Math.min(proRataShare, cap - distribution[name]);

        if (additionalAmount > 0) {
          distribution[name] += additionalAmount;
          remainingProceeds -= additionalAmount;
        }
      });

      // Founders get their pro-rata share
      if (currentData.shareholders['Founders']) {
        const founderProRata = (commonShares / totalParticipatingShares) * proRataDistribution;
        const founderShare = Math.min(founderProRata, remainingProceeds);
        distribution['Founders'] += founderShare;
        remainingProceeds -= founderShare;
      }
    } else {
      // Non-participating preferred: remaining goes to common shareholders
      const commonShares = (currentData.shareholders['Founders']?.shares || 0) +
                          (currentData.shareholders['Option Pool']?.shares || 0);

      if (commonShares > 0 && remainingProceeds > 0) {
        const founderShares = currentData.shareholders['Founders']?.shares || 0;
        const founderProRata = founderShares / commonShares;
        distribution['Founders'] = (distribution['Founders'] || 0) + (remainingProceeds * founderProRata);

        const optionShares = currentData.shareholders['Option Pool']?.shares || 0;
        const optionProRata = optionShares / commonShares;
        distribution['Option Pool'] = (distribution['Option Pool'] || 0) + (remainingProceeds * optionProRata);
      }
    }

    // Calculate returns and multiples
    const analysis = {};
    Object.keys(distribution).forEach(name => {
      const shareholder = currentData.shareholders[name];
      analysis[name] = {
        proceeds: distribution[name],
        invested: shareholder.invested || 0,
        multiple: shareholder.invested > 0 ? distribution[name] / shareholder.invested : 0,
        percentOfTotal: (distribution[name] / proceeds) * 100
      };
    });

    return analysis;
  }, [capTableData, rounds, exitValuation]);
  // Prepare chart data
  const ownershipChartData = useMemo(() => {
    return capTableData.map((entry, index) => {
      const data = { stage: entry.stage };
      Object.keys(entry.ownership).forEach(shareholder => {
        data[shareholder] = entry.ownership[shareholder].toFixed(2);
      });
      return data;
    });
  }, [capTableData]);

  const valuationChartData = useMemo(() => {
    return capTableData.map(entry => ({
      stage: entry.stage,
      'Share Price': entry.sharePrice ? entry.sharePrice.toFixed(4) : 0,
      'Post-Money Valuation': entry.postMoneyValuation / 1000000
    }));
  }, [capTableData]);

  const allShareholders = useMemo(() => {
    if (capTableData.length === 0) return [];
    const lastEntry = capTableData[capTableData.length - 1];
    return Object.keys(lastEntry.shareholders);
  }, [capTableData]);

  const shareholderColors = {
    'Founders': '#4a9eff',
    'Option Pool': '#a855f7',
    'Pre-Seed': '#00d4aa',
    'Seed': '#ffa726',
    'Series A': '#e94560',
    'Series B': '#ec4899',
    'Series C': '#06b6d4',
    'Series D': '#84cc16',
    'Series E': '#f97316',
    'Series F': '#14b8a6'
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const currentData = capTableData[capTableData.length - 1];

  // Input style for dark theme
  const inputStyle = {
    backgroundColor: 'var(--input-bg)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6" style={styles.bgPrimary}>
      {/* Add/Edit Round Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={styles.bgSecondary}>
            <div className="sticky top-0 border-b px-6 py-4 flex justify-between items-center" style={{ ...styles.bgSecondary, ...styles.border }}>
              <h2 className="text-xl font-bold" style={styles.textPrimary}>
                {editingIndex !== null ? 'Edit Round' : 'Add New Round'}
              </h2>
              <button onClick={closeModal} style={styles.textSecondary} className="hover:opacity-80">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Parameters */}
              <div>
                <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Round Name *</label>
                <input
                  type="text"
                  value={newRound.name}
                  onChange={(e) => setNewRound({...newRound, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                  style={inputStyle}
                  placeholder="e.g., Seed, Series A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Investment Amount ($) *</label>
                  <input
                    type="number"
                    value={newRound.investment}
                    onChange={(e) => setNewRound({...newRound, investment: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Pre-Money Valuation ($) *</label>
                  <input
                    type="number"
                    value={newRound.preMoneyValuation}
                    onChange={(e) => setNewRound({...newRound, preMoneyValuation: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="pt-2 border-t" style={styles.border}>
                <p className="text-sm" style={styles.textSecondary}>
                  Post-Money: <span className="font-semibold" style={styles.textPrimary}>{formatCurrency(newRound.preMoneyValuation + newRound.investment)}</span>
                  {' • '}
                  Investor Ownership: <span className="font-semibold" style={styles.textPrimary}>
                    {((newRound.investment / (newRound.preMoneyValuation + newRound.investment)) * 100).toFixed(2)}%
                  </span>
                </p>
              </div>

              {/* Option Pool */}
              <div className="pt-4 border-t" style={styles.border}>
                <h3 className="font-semibold mb-3" style={styles.textPrimary}>Option Pool</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Pool Size (%)</label>
                    <input
                      type="number"
                      value={newRound.optionPoolPct}
                      onChange={(e) => setNewRound({...newRound, optionPoolPct: Number(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                      style={inputStyle}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Pool Timing</label>
                    <select
                      value={newRound.optionPoolTiming}
                      onChange={(e) => setNewRound({...newRound, optionPoolTiming: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                      style={inputStyle}
                    >
                      <option value="pre">Pre-Money (founders diluted)</option>
                      <option value="post">Post-Money (all diluted)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs mt-2" style={styles.textSecondary}>
                  Pre-money pools dilute existing shareholders before new investment; post-money dilutes everyone including new investors
                </p>
              </div>

              {/* Liquidation Preferences */}
              <div className="pt-4 border-t" style={styles.border}>
                <h3 className="font-semibold mb-3" style={styles.textPrimary}>Liquidation Preferences</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Preference Multiple</label>
                    <input
                      type="number"
                      value={newRound.liquidationPreference}
                      onChange={(e) => setNewRound({...newRound, liquidationPreference: Number(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                      style={inputStyle}
                      min="1"
                      step="0.1"
                    />
                    <p className="text-xs mt-1" style={styles.textSecondary}>Typically 1x (returns invested capital first)</p>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 mt-7">
                      <input
                        type="checkbox"
                        checked={newRound.participating}
                        onChange={(e) => setNewRound({...newRound, participating: e.target.checked})}
                        className="w-4 h-4 rounded focus:ring-[#00d4aa]"
                        style={{ accentColor: 'var(--accent-1)' }}
                      />
                      <span className="text-sm font-medium" style={styles.textSecondary}>Participating Preferred</span>
                    </label>
                    <p className="text-xs mt-1 ml-6" style={styles.textSecondary}>Gets preference + pro-rata share of remainder</p>
                  </div>
                </div>

                {newRound.participating && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Participation Cap (multiple)</label>
                    <input
                      type="number"
                      value={newRound.participationCap}
                      onChange={(e) => setNewRound({...newRound, participationCap: Number(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                      style={inputStyle}
                      min="1"
                      step="0.5"
                    />
                    <p className="text-xs mt-1" style={styles.textSecondary}>Maximum total return as multiple of invested (typically 2-3x)</p>
                  </div>
                )}
              </div>

              {/* Anti-Dilution & Pro-Rata */}
              <div className="pt-4 border-t" style={styles.border}>
                <h3 className="font-semibold mb-3" style={styles.textPrimary}>Anti-Dilution & Pro-Rata Rights</h3>

                <div>
                  <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Anti-Dilution Protection</label>
                  <select
                    value={newRound.antiDilution}
                    onChange={(e) => setNewRound({...newRound, antiDilution: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                    style={inputStyle}
                  >
                    <option value="none">None</option>
                    <option value="weighted-average">Weighted Average</option>
                    <option value="full-ratchet">Full Ratchet</option>
                  </select>
                  <p className="text-xs mt-1" style={styles.textSecondary}>
                    Protection against down rounds (lower valuation than previous round)
                  </p>
                </div>

                <div className="mt-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newRound.proRataRights}
                      onChange={(e) => setNewRound({...newRound, proRataRights: e.target.checked})}
                      className="w-4 h-4 rounded focus:ring-[#00d4aa]"
                      style={{ accentColor: 'var(--accent-1)' }}
                    />
                    <span className="text-sm font-medium" style={styles.textSecondary}>Pro-Rata Rights</span>
                  </label>
                  <p className="text-xs mt-1 ml-6" style={styles.textSecondary}>Right to maintain ownership % in future rounds</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t" style={styles.border}>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-md transition-colors"
                  style={{ ...styles.bgTertiary, ...styles.textPrimary }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveRound}
                  className="px-4 py-2 rounded-md transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent-1)', color: 'var(--bg-primary)' }}
                >
                  {editingIndex !== null ? 'Update Round' : 'Add Round'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="rounded-lg shadow-lg p-6 mb-6" style={styles.bgSecondary}>
        <h1 className="text-3xl font-bold mb-2" style={{ ...styles.textPrimary, fontFamily: "'Crimson Pro', serif" }}>Cap Table & Dilution Analyzer</h1>
        <p className="mb-6" style={styles.textSecondary}>Model venture funding rounds with liquidation preferences, anti-dilution protection, and ownership dynamics</p>

        {/* Summary Cards */}
        {rounds.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(74, 158, 255, 0.1)', borderColor: 'rgba(74, 158, 255, 0.3)' }}>
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 mr-2" style={{ color: 'var(--accent-2)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--accent-2)' }}>Current Stage</h3>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-2)' }}>{currentData.stage}</p>
              <p className="text-sm" style={styles.textSecondary}>{formatCurrency(currentData.postMoneyValuation)} valuation</p>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(0, 212, 170, 0.1)', borderColor: 'rgba(0, 212, 170, 0.3)' }}>
              <div className="flex items-center mb-2">
                <TrendingUp className="w-5 h-5 mr-2" style={{ color: 'var(--accent-1)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--accent-1)' }}>Founder Ownership</h3>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-1)' }}>
                {currentData.ownership['Founders']?.toFixed(1)}%
              </p>
              <p className="text-sm" style={styles.textSecondary}>Fully diluted basis</p>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
              <div className="flex items-center mb-2">
                <DollarSign className="w-5 h-5 mr-2" style={{ color: 'var(--accent-5)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--accent-5)' }}>Share Price</h3>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-5)' }}>
                ${currentData.sharePrice?.toFixed(4)}
              </p>
              <p className="text-sm" style={styles.textSecondary}>Current value</p>
            </div>
          </div>
        )}

        {/* Founding Parameters */}
        <div className="rounded-lg p-4 mb-6 border" style={{ ...styles.bgTertiary, ...styles.border }}>
          <h3 className="font-semibold mb-3" style={styles.textPrimary}>Founding Parameters</h3>
          <div>
            <label className="block text-sm font-medium mb-1" style={styles.textSecondary}>Founding Shares</label>
            <input
              type="number"
              value={foundingShares}
              onChange={(e) => setFoundingShares(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Funding Rounds */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold" style={styles.textPrimary}>Funding Rounds</h3>
            <button
              onClick={openAddModal}
              className="flex items-center px-4 py-2 rounded-md transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-1)', color: 'var(--bg-primary)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Round
            </button>
          </div>

          {rounds.length === 0 ? (
            <div className="rounded-lg p-8 border-2 border-dashed text-center" style={{ ...styles.bgTertiary, borderColor: 'var(--border-color)' }}>
              <p style={styles.textSecondary}>No funding rounds yet. Click "Add Round" to begin modeling your cap table.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round, index) => (
                <div key={index} className="rounded-lg p-4 border" style={{ ...styles.bgTertiary, ...styles.border }}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h4 className="text-lg font-semibold" style={styles.textPrimary}>{round.name}</h4>
                        <button
                          onClick={() => openEditModal(index)}
                          className="ml-3 hover:opacity-80"
                          style={{ color: 'var(--accent-2)' }}
                          title="Edit round"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span style={styles.textSecondary}>Investment:</span>
                          <p className="font-semibold" style={styles.textPrimary}>{formatCurrency(round.investment)}</p>
                        </div>
                        <div>
                          <span style={styles.textSecondary}>Pre-Money:</span>
                          <p className="font-semibold" style={styles.textPrimary}>{formatCurrency(round.preMoneyValuation)}</p>
                        </div>
                        <div>
                          <span style={styles.textSecondary}>Post-Money:</span>
                          <p className="font-semibold" style={styles.textPrimary}>{formatCurrency(round.preMoneyValuation + round.investment)}</p>
                        </div>
                        <div>
                          <span style={styles.textSecondary}>New Investor:</span>
                          <p className="font-semibold" style={styles.textPrimary}>{((round.investment / (round.preMoneyValuation + round.investment)) * 100).toFixed(2)}%</p>
                        </div>
                      </div>
                      {(round.optionPoolPct > 0 || round.liquidationPreference > 1 || round.participating || round.antiDilution !== 'none') && (
                        <div className="mt-2 pt-2 border-t flex flex-wrap gap-2" style={styles.border}>
                          {round.optionPoolPct > 0 && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-5)' }}>
                              {round.optionPoolPct}% Pool ({round.optionPoolTiming})
                            </span>
                          )}
                          {round.liquidationPreference > 1 && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(74, 158, 255, 0.2)', color: 'var(--accent-2)' }}>
                              {round.liquidationPreference}x Preference
                            </span>
                          )}
                          {round.participating && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(0, 212, 170, 0.2)', color: 'var(--accent-1)' }}>
                              Participating ({round.participationCap}x cap)
                            </span>
                          )}
                          {round.antiDilution !== 'none' && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(255, 167, 38, 0.2)', color: 'var(--accent-4)' }}>
                              {round.antiDilution === 'full-ratchet' ? 'Full Ratchet' : 'Weighted Avg'} Protection
                            </span>
                          )}
                          {round.proRataRights && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(139, 149, 165, 0.2)', color: 'var(--text-secondary)' }}>
                              Pro-Rata Rights
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeRound(index)}
                      className="ml-4 hover:opacity-80"
                      style={{ color: 'var(--accent-3)' }}
                      title="Delete round"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {rounds.length > 0 && (
        <>
          {/* Ownership Evolution Chart */}
          <div className="rounded-lg shadow-lg p-6 mb-6" style={styles.bgSecondary}>
            <h2 className="text-xl font-bold mb-4" style={styles.textPrimary}>Ownership Evolution</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={ownershipChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="stage" stroke="var(--text-secondary)" />
                <YAxis domain={[0, 100]} label={{ value: 'Ownership %', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }} stroke="var(--text-secondary)" />
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                {allShareholders.map(shareholder => (
                  <Line
                    key={shareholder}
                    type="monotone"
                    dataKey={shareholder}
                    stroke={shareholderColors[shareholder] || '#6b7280'}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Share Price Evolution */}
          <div className="rounded-lg shadow-lg p-6 mb-6" style={styles.bgSecondary}>
            <h2 className="text-xl font-bold mb-4" style={styles.textPrimary}>Share Price & Valuation Growth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={valuationChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="stage" stroke="var(--text-secondary)" />
                <YAxis yAxisId="left" label={{ value: 'Share Price ($)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }} stroke="var(--text-secondary)" />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Valuation ($M)', angle: 90, position: 'insideRight', fill: 'var(--text-secondary)' }} stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                <Bar yAxisId="right" dataKey="Post-Money Valuation" fill="var(--accent-1)" />
                <Line yAxisId="left" type="monotone" dataKey="Share Price" stroke="var(--accent-2)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>



          {/* Cap Table Snapshot */}
          <div className="rounded-lg shadow-lg p-6 mb-6" style={styles.bgSecondary}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={styles.textPrimary}>Current Cap Table</h2>
              <button
                onClick={() => exportToPDF(capTableRef, 'Cap-Table.pdf')}
                className="flex items-center px-3 py-1.5 rounded-md text-sm transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-2)', color: 'var(--bg-primary)' }}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export PDF
              </button>
            </div>
            <div className="overflow-x-auto" ref={capTableRef}>
              <table className="w-full">
                <thead style={styles.bgTertiary}>
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold" style={styles.textSecondary}>Shareholder</th>
                    <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Shares</th>
                    <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Ownership %</th>
                    <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Value</th>
                    <th className="px-4 py-2 text-left font-semibold" style={styles.textSecondary}>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(currentData.shareholders)
                    .sort((a, b) => b[1].shares - a[1].shares)
                    .map(([name, data]) => (
                      <tr key={name} className="border-b" style={styles.border}>
                        <td className="px-4 py-3 font-medium" style={styles.textPrimary}>{name}</td>
                        <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                          {data.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                          {currentData.ownership[name]?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                          {formatCurrency(data.shares * currentData.sharePrice)}
                        </td>
                        <td className="px-4 py-3" style={styles.textSecondary}>{data.class}</td>
                      </tr>
                    ))}
                  <tr className="font-semibold" style={styles.bgTertiary}>
                    <td className="px-4 py-3" style={styles.textPrimary}>Total</td>
                    <td className="px-4 py-3 text-right" style={styles.textPrimary}>
                      {currentData.totalShares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right" style={styles.textPrimary}>100.00%</td>
                    <td className="px-4 py-3 text-right" style={styles.textPrimary}>
                      {formatCurrency(currentData.postMoneyValuation)}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Exit Scenario Modeling */}
          {liquidationAnalysis && (
            <div className="rounded-lg shadow-lg p-6 mb-6" style={styles.bgSecondary}>
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2" style={styles.textPrimary}>Exit Scenario Modeling</h2>
                <p className="text-sm mb-4" style={styles.textSecondary}>Model how exit proceeds are distributed based on liquidation preferences and participation rights</p>

                <div className="rounded-lg p-4 mb-4 border" style={{ backgroundColor: 'rgba(74, 158, 255, 0.1)', borderColor: 'rgba(74, 158, 255, 0.3)' }}>
                  <label className="block text-sm font-medium mb-2" style={styles.textSecondary}>Exit Valuation ($)</label>
                  <input
                    type="number"
                    value={exitValuation}
                    onChange={(e) => setExitValuation(Number(e.target.value))}
                    className="w-full px-4 py-3 border rounded-md text-lg font-semibold focus:ring-2 focus:ring-[#00d4aa] focus:border-transparent"
                    style={inputStyle}
                    placeholder="Enter exit valuation"
                  />
                  <p className="text-xs mt-2" style={styles.textSecondary}>Enter a potential exit valuation to see how proceeds would be distributed among shareholders</p>
                </div>
              </div>

              {/* Waterfall Breakdown */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3" style={styles.textPrimary}>Liquidation Waterfall Breakdown</h3>
                <div className="space-y-3">
                  {(() => {
                    const steps = [];
                    let remainingProceeds = exitValuation;

                    // Step 1: Liquidation Preferences
                    const preferredHolders = Object.keys(currentData.shareholders)
                      .filter(name => currentData.shareholders[name].class === 'Preferred')
                      .sort((a, b) => {
                        const aIndex = rounds.findIndex(r => r.name === a);
                        const bIndex = rounds.findIndex(r => r.name === b);
                        return bIndex - aIndex;
                      });

                    if (preferredHolders.length > 0) {
                      const preferencePayments = preferredHolders.map(name => {
                        const shareholder = currentData.shareholders[name];
                        const prefs = shareholder.preferences;
                        const liquidationAmount = shareholder.invested * (prefs.liquidationPreference || 1);
                        const actualPayment = Math.min(liquidationAmount, remainingProceeds);
                        remainingProceeds -= actualPayment;
                        return { name, amount: actualPayment, preference: liquidationAmount };
                      });

                      steps.push(
                        <div key="step1" className="rounded-lg p-4 border" style={{ ...styles.bgTertiary, ...styles.border }}>
                          <div className="flex items-center mb-2">
                            <div className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2" style={{ backgroundColor: 'var(--accent-2)', color: 'var(--bg-primary)' }}>1</div>
                            <h4 className="font-semibold" style={styles.textPrimary}>Pay Liquidation Preferences</h4>
                          </div>
                          <p className="text-sm mb-3" style={styles.textSecondary}>Preferred shareholders receive their liquidation preference (typically 1x investment) in order of seniority</p>
                          <div className="space-y-2">
                            {preferencePayments.map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span style={styles.textSecondary}>{p.name}</span>
                                <span className="font-semibold" style={styles.textPrimary}>
                                  {formatCurrency(p.amount)}
                                  {p.amount < p.preference && <span style={{ color: 'var(--accent-3)' }} className="ml-1">(partial)</span>}
                                </span>
                              </div>
                            ))}
                            <div className="pt-2 border-t flex justify-between font-semibold" style={styles.border}>
                              <span style={styles.textSecondary}>Remaining Proceeds:</span>
                              <span style={styles.textPrimary}>{formatCurrency(remainingProceeds)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Step 2: Participating Preferred
                    const participatingHolders = preferredHolders.filter(name =>
                      currentData.shareholders[name].preferences.participating
                    );

                    if (participatingHolders.length > 0 && remainingProceeds > 0) {
                      const beforeParticipation = remainingProceeds;
                      const participationPayments = [];

                      const participatingShares = participatingHolders.reduce((sum, name) =>
                        sum + currentData.shareholders[name].shares, 0
                      );
                      const commonShares = (currentData.shareholders['Founders']?.shares || 0);
                      const totalParticipatingShares = participatingShares + commonShares;

                      participatingHolders.forEach(name => {
                        const shareholder = currentData.shareholders[name];
                        const proRataShare = (shareholder.shares / totalParticipatingShares) * beforeParticipation;
                        const alreadyReceived = shareholder.invested * (shareholder.preferences.liquidationPreference || 1);
                        const cap = shareholder.preferences.participationCap * shareholder.invested;
                        const additionalAmount = Math.min(proRataShare, Math.max(0, cap - alreadyReceived));

                        participationPayments.push({ name, amount: additionalAmount });
                        remainingProceeds -= additionalAmount;
                      });

                      // Founders' participation
                      const founderProRata = (commonShares / totalParticipatingShares) * beforeParticipation;
                      const founderShare = Math.min(founderProRata, remainingProceeds);
                      participationPayments.push({ name: 'Founders', amount: founderShare });
                      remainingProceeds -= founderShare;

                      steps.push(
                        <div key="step2" className="rounded-lg p-4 border" style={{ ...styles.bgTertiary, ...styles.border }}>
                          <div className="flex items-center mb-2">
                            <div className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2" style={{ backgroundColor: 'var(--accent-1)', color: 'var(--bg-primary)' }}>2</div>
                            <h4 className="font-semibold" style={styles.textPrimary}>Participating Preferred Distribution</h4>
                          </div>
                          <p className="text-sm mb-3" style={styles.textSecondary}>Participating preferred and common shareholders share remaining proceeds pro-rata (up to participation caps)</p>
                          <div className="space-y-2">
                            {participationPayments.map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span style={styles.textSecondary}>{p.name}</span>
                                <span className="font-semibold" style={styles.textPrimary}>{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                            <div className="pt-2 border-t flex justify-between font-semibold" style={styles.border}>
                              <span style={styles.textSecondary}>Remaining Proceeds:</span>
                              <span style={styles.textPrimary}>{formatCurrency(remainingProceeds)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (remainingProceeds > 0) {
                      // Non-participating preferred: remainder to common
                      const commonShares = (currentData.shareholders['Founders']?.shares || 0) +
                                          (currentData.shareholders['Option Pool']?.shares || 0);

                      if (commonShares > 0) {
                        const founderShares = currentData.shareholders['Founders']?.shares || 0;
                        const founderAmount = (founderShares / commonShares) * remainingProceeds;
                        const optionAmount = remainingProceeds - founderAmount;

                        steps.push(
                          <div key="step2" className="rounded-lg p-4 border" style={{ ...styles.bgTertiary, ...styles.border }}>
                            <div className="flex items-center mb-2">
                              <div className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2" style={{ backgroundColor: 'var(--accent-1)', color: 'var(--bg-primary)' }}>2</div>
                              <h4 className="font-semibold" style={styles.textPrimary}>Common Shareholder Distribution</h4>
                            </div>
                            <p className="text-sm mb-3" style={styles.textSecondary}>Remaining proceeds distributed pro-rata to common shareholders</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span style={styles.textSecondary}>Founders</span>
                                <span className="font-semibold" style={styles.textPrimary}>{formatCurrency(founderAmount)}</span>
                              </div>
                              {optionAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span style={styles.textSecondary}>Option Pool</span>
                                  <span className="font-semibold" style={styles.textPrimary}>{formatCurrency(optionAmount)}</span>
                                </div>
                              )}
                              <div className="pt-2 border-t flex justify-between font-semibold" style={styles.border}>
                                <span style={styles.textSecondary}>Remaining Proceeds:</span>
                                <span style={styles.textPrimary}>{formatCurrency(0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    }

                    return steps;
                  })()}
                </div>
              </div>

              {/* Final Distribution Table */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold" style={styles.textPrimary}>Final Distribution Summary</h3>
                  <button
                    onClick={() => exportToPDF(exitDistributionRef, 'Exit-Distribution.pdf')}
                    className="flex items-center px-3 py-1.5 rounded-md text-sm transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent-2)', color: 'var(--bg-primary)' }}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Export PDF
                  </button>
                </div>
                <div className="overflow-x-auto" ref={exitDistributionRef}>
                  <table className="w-full">
                    <thead style={styles.bgTertiary}>
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold" style={styles.textSecondary}>Shareholder</th>
                        <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Invested</th>
                        <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Proceeds</th>
                        <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>Return (x)</th>
                        <th className="px-4 py-2 text-right font-semibold" style={styles.textSecondary}>% of Exit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(liquidationAnalysis)
                        .filter(([_, data]) => data.proceeds > 0)
                        .sort((a, b) => b[1].proceeds - a[1].proceeds)
                        .map(([name, data]) => (
                          <tr key={name} className="border-b" style={styles.border}>
                            <td className="px-4 py-3 font-medium" style={styles.textPrimary}>{name}</td>
                            <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                              {data.invested > 0 ? formatCurrency(data.invested) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold" style={styles.textPrimary}>
                              {formatCurrency(data.proceeds)}
                            </td>
                            <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                              {data.multiple > 0 ? (
                                <span className="font-semibold" style={{ color: data.multiple >= 1 ? 'var(--accent-1)' : 'var(--accent-3)' }}>
                                  {data.multiple.toFixed(2)}x
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right" style={styles.textSecondary}>
                              {data.percentOfTotal.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      <tr className="font-semibold" style={styles.bgTertiary}>
                        <td className="px-4 py-3" style={styles.textPrimary}>Total</td>
                        <td className="px-4 py-3 text-right" style={styles.textPrimary}>
                          {formatCurrency(Object.values(liquidationAnalysis).reduce((sum, d) => sum + d.invested, 0))}
                        </td>
                        <td className="px-4 py-3 text-right" style={styles.textPrimary}>
                          {formatCurrency(exitValuation)}
                        </td>
                        <td className="px-4 py-3 text-right" style={styles.textPrimary}>
                          {(exitValuation / Object.values(liquidationAnalysis).reduce((sum, d) => sum + d.invested, 0)).toFixed(2)}x
                        </td>
                        <td className="px-4 py-3 text-right" style={styles.textPrimary}>100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Educational Note */}
              <div className="mt-6 p-4 rounded-lg border" style={{ backgroundColor: 'rgba(74, 158, 255, 0.1)', borderColor: 'rgba(74, 158, 255, 0.3)' }}>
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-2)' }} />
                  <div className="text-sm" style={{ color: 'var(--accent-2)' }}>
                    <p className="font-semibold mb-2">Understanding Liquidation Preferences:</p>
                    <p className="mb-2" style={styles.textSecondary}><strong style={styles.textPrimary}>Non-participating preferred:</strong> Investors choose between their liquidation preference OR converting to common and taking their pro-rata share (whichever is higher).</p>
                    <p className="mb-2" style={styles.textSecondary}><strong style={styles.textPrimary}>Participating preferred:</strong> Investors get their liquidation preference first, THEN participate pro-rata with common in remaining proceeds (up to participation cap).</p>
                    <p style={styles.textSecondary}><strong style={styles.textPrimary}>Example:</strong> With a 1x non-participating preference, an investor who owns 20% and invested $1M would take $1M in exits up to $5M (1M preference {'>'} 20% of proceeds), but would convert to common for exits above $5M (20% share {'>'} $1M preference).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="rounded-lg p-6 border" style={{ backgroundColor: 'rgba(0, 212, 170, 0.1)', borderColor: 'rgba(0, 212, 170, 0.3)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--accent-1)' }}>Key Insights</h3>
            <div className="space-y-2 text-sm" style={styles.textSecondary}>
              <p>• Founders started with 100% and now own {currentData.ownership['Founders']?.toFixed(1)}% after {rounds.length} funding round{rounds.length > 1 ? 's' : ''}</p>
              <p>• Total dilution: {(100 - currentData.ownership['Founders']).toFixed(1)} percentage points</p>
              <p>• Share price appreciation: {capTableData[1]?.sharePrice > 0 ? `${((currentData.sharePrice / capTableData[1].sharePrice)).toFixed(1)}x` : 'N/A'} from first funding round</p>
              <p>• Company valuation: {formatCurrency(currentData.postMoneyValuation)} ({((currentData.postMoneyValuation / foundingShares - 1) * 100).toFixed(0)}% increase from founding)</p>
              {liquidationAnalysis && (
                <>
                  <p>• At {formatCurrency(exitValuation)} exit, founders would receive {formatCurrency(liquidationAnalysis['Founders']?.proceeds || 0)} ({liquidationAnalysis['Founders']?.percentOfTotal.toFixed(1)}% of proceeds)</p>
                  <p>• Investor returns at this exit: {Object.entries(liquidationAnalysis)
                    .filter(([name]) => name !== 'Founders' && name !== 'Option Pool')
                    .map(([name, data]) => `${name} ${data.multiple.toFixed(1)}x`)
                    .join(', ') || 'N/A'}</p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CapTableTool;
