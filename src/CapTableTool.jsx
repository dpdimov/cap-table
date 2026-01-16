import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, TrendingUp, Users, DollarSign, X, Edit2, AlertCircle } from 'lucide-react';

const CapTableTool = () => {
  const [foundingShares, setFoundingShares] = useState(1000000);
  const [rounds, setRounds] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [exitValuation, setExitValuation] = useState(50000000);
  
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
    'Founders': '#3b82f6',
    'Option Pool': '#8b5cf6',
    'Pre-Seed': '#10b981',
    'Seed': '#f59e0b',
    'Series A': '#ef4444',
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

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-50">
      {/* Add/Edit Round Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {editingIndex !== null ? 'Edit Round' : 'Add New Round'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Basic Parameters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Name *</label>
                <input
                  type="text"
                  value={newRound.name}
                  onChange={(e) => setNewRound({...newRound, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Seed, Series A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Investment Amount ($) *</label>
                  <input
                    type="number"
                    value={newRound.investment}
                    onChange={(e) => setNewRound({...newRound, investment: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pre-Money Valuation ($) *</label>
                  <input
                    type="number"
                    value={newRound.preMoneyValuation}
                    onChange={(e) => setNewRound({...newRound, preMoneyValuation: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  Post-Money: <span className="font-semibold">{formatCurrency(newRound.preMoneyValuation + newRound.investment)}</span>
                  {' • '}
                  Investor Ownership: <span className="font-semibold">
                    {((newRound.investment / (newRound.preMoneyValuation + newRound.investment)) * 100).toFixed(2)}%
                  </span>
                </p>
              </div>

              {/* Option Pool */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Option Pool</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pool Size (%)</label>
                    <input
                      type="number"
                      value={newRound.optionPoolPct}
                      onChange={(e) => setNewRound({...newRound, optionPoolPct: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pool Timing</label>
                    <select
                      value={newRound.optionPoolTiming}
                      onChange={(e) => setNewRound({...newRound, optionPoolTiming: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pre">Pre-Money (founders diluted)</option>
                      <option value="post">Post-Money (all diluted)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Pre-money pools dilute existing shareholders before new investment; post-money dilutes everyone including new investors
                </p>
              </div>

              {/* Liquidation Preferences */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Liquidation Preferences</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preference Multiple</label>
                    <input
                      type="number"
                      value={newRound.liquidationPreference}
                      onChange={(e) => setNewRound({...newRound, liquidationPreference: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typically 1x (returns invested capital first)</p>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 mt-7">
                      <input
                        type="checkbox"
                        checked={newRound.participating}
                        onChange={(e) => setNewRound({...newRound, participating: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Participating Preferred</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">Gets preference + pro-rata share of remainder</p>
                  </div>
                </div>

                {newRound.participating && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Participation Cap (multiple)</label>
                    <input
                      type="number"
                      value={newRound.participationCap}
                      onChange={(e) => setNewRound({...newRound, participationCap: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      step="0.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum total return as multiple of invested (typically 2-3x)</p>
                  </div>
                )}
              </div>

              {/* Anti-Dilution & Pro-Rata */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Anti-Dilution & Pro-Rata Rights</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anti-Dilution Protection</label>
                  <select
                    value={newRound.antiDilution}
                    onChange={(e) => setNewRound({...newRound, antiDilution: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="weighted-average">Weighted Average</option>
                    <option value="full-ratchet">Full Ratchet</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Protection against down rounds (lower valuation than previous round)
                  </p>
                </div>

                <div className="mt-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newRound.proRataRights}
                      onChange={(e) => setNewRound({...newRound, proRataRights: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Pro-Rata Rights</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">Right to maintain ownership % in future rounds</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRound}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingIndex !== null ? 'Update Round' : 'Add Round'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Cap Table & Dilution Analyzer</h1>
        <p className="text-gray-600 mb-6">Model venture funding rounds with liquidation preferences, anti-dilution protection, and ownership dynamics</p>

        {/* Summary Cards */}
        {rounds.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-blue-900">Current Stage</h3>
              </div>
              <p className="text-2xl font-bold text-blue-700">{currentData.stage}</p>
              <p className="text-sm text-blue-600">{formatCurrency(currentData.postMoneyValuation)} valuation</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center mb-2">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-semibold text-green-900">Founder Ownership</h3>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {currentData.ownership['Founders']?.toFixed(1)}%
              </p>
              <p className="text-sm text-green-600">Fully diluted basis</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center mb-2">
                <DollarSign className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="font-semibold text-purple-900">Share Price</h3>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                ${currentData.sharePrice?.toFixed(4)}
              </p>
              <p className="text-sm text-purple-600">Current value</p>
            </div>
          </div>
        )}

        {/* Founding Parameters */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <h3 className="font-semibold mb-3 text-gray-800">Founding Parameters</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Founding Shares</label>
            <input
              type="number"
              value={foundingShares}
              onChange={(e) => setFoundingShares(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Funding Rounds */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">Funding Rounds</h3>
            <button
              onClick={openAddModal}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Round
            </button>
          </div>

          {rounds.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 border-2 border-dashed border-gray-300 text-center">
              <p className="text-gray-600">No funding rounds yet. Click "Add Round" to begin modeling your cap table.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h4 className="text-lg font-semibold text-gray-800">{round.name}</h4>
                        <button
                          onClick={() => openEditModal(index)}
                          className="ml-3 text-blue-600 hover:text-blue-800"
                          title="Edit round"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Investment:</span>
                          <p className="font-semibold">{formatCurrency(round.investment)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Pre-Money:</span>
                          <p className="font-semibold">{formatCurrency(round.preMoneyValuation)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Post-Money:</span>
                          <p className="font-semibold">{formatCurrency(round.preMoneyValuation + round.investment)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">New Investor:</span>
                          <p className="font-semibold">{((round.investment / (round.preMoneyValuation + round.investment)) * 100).toFixed(2)}%</p>
                        </div>
                      </div>
                      {(round.optionPoolPct > 0 || round.liquidationPreference > 1 || round.participating || round.antiDilution !== 'none') && (
                        <div className="mt-2 pt-2 border-t border-gray-300 flex flex-wrap gap-2">
                          {round.optionPoolPct > 0 && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                              {round.optionPoolPct}% Pool ({round.optionPoolTiming})
                            </span>
                          )}
                          {round.liquidationPreference > 1 && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {round.liquidationPreference}x Preference
                            </span>
                          )}
                          {round.participating && (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                              Participating ({round.participationCap}x cap)
                            </span>
                          )}
                          {round.antiDilution !== 'none' && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                              {round.antiDilution === 'full-ratchet' ? 'Full Ratchet' : 'Weighted Avg'} Protection
                            </span>
                          )}
                          {round.proRataRights && (
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded">
                              Pro-Rata Rights
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeRound(index)}
                      className="ml-4 text-red-600 hover:text-red-800"
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
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Ownership Evolution</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={ownershipChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis domain={[0, 100]} label={{ value: 'Ownership %', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
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
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Share Price & Valuation Growth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={valuationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis yAxisId="left" label={{ value: 'Share Price ($)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Valuation ($M)', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="Post-Money Valuation" fill="#10b981" />
                <Line yAxisId="left" type="monotone" dataKey="Share Price" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>



          {/* Cap Table Snapshot */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Current Cap Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Shareholder</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Shares</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Ownership %</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Value</th>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(currentData.shareholders)
                    .sort((a, b) => b[1].shares - a[1].shares)
                    .map(([name, data]) => (
                      <tr key={name} className="border-b border-gray-200">
                        <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {data.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {currentData.ownership[name]?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(data.shares * currentData.sharePrice)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{data.class}</td>
                      </tr>
                    ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-gray-800">Total</td>
                    <td className="px-4 py-3 text-right text-gray-800">
                      {currentData.totalShares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800">100.00%</td>
                    <td className="px-4 py-3 text-right text-gray-800">
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
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Exit Scenario Modeling</h2>
                <p className="text-sm text-gray-600 mb-4">Model how exit proceeds are distributed based on liquidation preferences and participation rights</p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exit Valuation ($)</label>
                  <input
                    type="number"
                    value={exitValuation}
                    onChange={(e) => setExitValuation(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter exit valuation"
                  />
                  <p className="text-xs text-gray-600 mt-2">Enter a potential exit valuation to see how proceeds would be distributed among shareholders</p>
                </div>
              </div>

              {/* Waterfall Breakdown */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Liquidation Waterfall Breakdown</h3>
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
                        <div key="step1" className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-2">
                            <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">1</div>
                            <h4 className="font-semibold text-gray-800">Pay Liquidation Preferences</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">Preferred shareholders receive their liquidation preference (typically 1x investment) in order of seniority</p>
                          <div className="space-y-2">
                            {preferencePayments.map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span className="text-gray-700">{p.name}</span>
                                <span className="font-semibold text-gray-800">
                                  {formatCurrency(p.amount)}
                                  {p.amount < p.preference && <span className="text-red-600 ml-1">(partial)</span>}
                                </span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-gray-300 flex justify-between font-semibold">
                              <span>Remaining Proceeds:</span>
                              <span>{formatCurrency(remainingProceeds)}</span>
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
                        <div key="step2" className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-2">
                            <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">2</div>
                            <h4 className="font-semibold text-gray-800">Participating Preferred Distribution</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">Participating preferred and common shareholders share remaining proceeds pro-rata (up to participation caps)</p>
                          <div className="space-y-2">
                            {participationPayments.map(p => (
                              <div key={p.name} className="flex justify-between text-sm">
                                <span className="text-gray-700">{p.name}</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-gray-300 flex justify-between font-semibold">
                              <span>Remaining Proceeds:</span>
                              <span>{formatCurrency(remainingProceeds)}</span>
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
                          <div key="step2" className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center mb-2">
                              <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">2</div>
                              <h4 className="font-semibold text-gray-800">Common Shareholder Distribution</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">Remaining proceeds distributed pro-rata to common shareholders</p>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Founders</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(founderAmount)}</span>
                              </div>
                              {optionAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-700">Option Pool</span>
                                  <span className="font-semibold text-gray-800">{formatCurrency(optionAmount)}</span>
                                </div>
                              )}
                              <div className="pt-2 border-t border-gray-300 flex justify-between font-semibold">
                                <span>Remaining Proceeds:</span>
                                <span>{formatCurrency(0)}</span>
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
                <h3 className="font-semibold text-gray-800 mb-3">Final Distribution Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Shareholder</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">Invested</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">Proceeds</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">Return (x)</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">% of Exit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(liquidationAnalysis)
                        .filter(([_, data]) => data.proceeds > 0)
                        .sort((a, b) => b[1].proceeds - a[1].proceeds)
                        .map(([name, data]) => (
                          <tr key={name} className="border-b border-gray-200">
                            <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {data.invested > 0 ? formatCurrency(data.invested) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(data.proceeds)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {data.multiple > 0 ? (
                                <span className={data.multiple >= 1 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                  {data.multiple.toFixed(2)}x
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {data.percentOfTotal.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-gray-800">Total</td>
                        <td className="px-4 py-3 text-right text-gray-800">
                          {formatCurrency(Object.values(liquidationAnalysis).reduce((sum, d) => sum + d.invested, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">
                          {formatCurrency(exitValuation)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">
                          {(exitValuation / Object.values(liquidationAnalysis).reduce((sum, d) => sum + d.invested, 0)).toFixed(2)}x
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Educational Note */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-2">Understanding Liquidation Preferences:</p>
                    <p className="mb-2"><strong>Non-participating preferred:</strong> Investors choose between their liquidation preference OR converting to common and taking their pro-rata share (whichever is higher).</p>
                    <p className="mb-2"><strong>Participating preferred:</strong> Investors get their liquidation preference first, THEN participate pro-rata with common in remaining proceeds (up to participation cap).</p>
                    <p><strong>Example:</strong> With a 1x non-participating preference, an investor who owns 20% and invested $1M would take $1M in exits up to $5M (1M preference > 20% of proceeds), but would convert to common for exits above $5M (20% share > $1M preference).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">Key Insights</h3>
            <div className="space-y-2 text-sm text-blue-800">
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
