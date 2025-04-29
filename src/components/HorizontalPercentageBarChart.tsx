import React, { useMemo } from 'react';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, LabelList, TooltipProps, Legend
} from 'recharts';

// Define the data shape for the chart
interface DataItem {
  name: string;
  value?: number;
  [key: string]: any; // Allow for additional properties
}

interface HorizontalPercentageBarChartProps {
  data: DataItem[];
  dataKey?: string;
  stackKeys?: string[];
  barColors?: Record<string, string>;
  height?: number;
  width?: string | number;
  isDarkMode?: boolean;
}

// Custom tooltip formatter that shows both value and percentage
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    // Calculate the total of all values in this bar
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    
    return (
      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 shadow-md rounded-md">
        <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {payload.map((entry, index) => {
          // Safely calculate percentage, handling edge cases
          const value = entry.value || 0;
          let percentageText = '0%';
          if (total > 0 && !isNaN(value)) {
            percentageText = `${Math.round((value / total) * 100)}%`;
          }

          return (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${value} (${percentageText})`}
            </p>
          );
        })}
      </div>
    );
  }
  
  return null;
};

// Define the label renderer function
// It now accepts the segment key and the chart data as arguments
const renderCustomizedLabel = (props: any, segmentKey: string, dataForChart: DataItem[]) => {
  // Destructure necessary props, including index
  const { x, y, width, height, index } = props; 

  // Get the full data item for this bar using the index
  const fullBarData = dataForChart[index];

  // Ensure we have the full bar data and the pre-calculated percentage
  const percentKey = `${segmentKey}_percent`;
  if (fullBarData == null || typeof fullBarData !== 'object' || typeof fullBarData[percentKey] !== 'number') {
     console.error(`Label Error: Data or percentage missing for index ${index}, key ${segmentKey}`, { fullBarData });
     return null;
  }

  const percentage = fullBarData[percentKey];

  // Only render label if segment has sufficient width and percentage is >= 1
  if (width < 20 || !isFinite(percentage) || percentage < 1) {
    return null;
  }
  
  // Use Math.round to match the tooltip calculation
  const percentText = `${Math.round(percentage)}%`; 

  // Always use white text color
  const textColor = '#FFFFFF'; 

  return (
    <text 
      x={x + width / 2}
      y={y + height / 2}
      fill={textColor} // Use white color
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight="bold"
      style={{ 
        pointerEvents: 'none'
      }}
    >
      {percentText}
    </text>
  );
};

export const HorizontalPercentageBarChart: React.FC<HorizontalPercentageBarChartProps> = ({
  data,
  dataKey = 'value',
  stackKeys = ['Voted', 'NotVoted'],
  barColors = { Voted: '#4CAF50', NotVoted: '#F44336' }, // Default colors
  height = 350,
  width = '100%',
  isDarkMode = false
}) => {
  // Process data: calculate total AND pre-calculate percentages for each segment
  const processedData = useMemo(() => {
    return data.filter(item => item && item.name).map(item => {
      const newItem = { ...item };
      let totalValue = 0;
      
      // First pass: ensure numeric values and calculate total
      stackKeys.forEach(key => {
        const numericValue = Number(newItem[key]);
        if (newItem[key] === undefined || newItem[key] === null || isNaN(numericValue)) {
          newItem[key] = 0;
        } else {
          newItem[key] = numericValue;
          totalValue += numericValue;
        }
      });

      newItem.totalValue = totalValue; 

      // Second pass: calculate percentages for each key
      stackKeys.forEach(key => {
        const value = newItem[key];
        const percentage = (totalValue > 0 && !isNaN(value)) ? (value / totalValue) * 100 : 0;
        newItem[`${key}_percent`] = percentage; // Store as e.g., Voted_percent
      });
      
      return newItem;
    });
  }, [data, stackKeys]);

  // Remove previous logs
  // console.log("Processed Data for Chart:", processedData); 

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={processedData}
        layout="vertical"
        margin={{ top: 10, right: 50, left: 40, bottom: 10 }}
        barGap={0}
        barSize={30}
      >
        <CartesianGrid 
          strokeDasharray="3 3" 
          horizontal={true}
          vertical={false}
          stroke={isDarkMode ? "#374151" : "#e5e7eb"} 
        />
        <XAxis 
          type="number" 
          stroke={isDarkMode ? "#9ca3af" : "#6b7280"} 
        />
        <YAxis 
          dataKey="name"
          type="category" 
          width={120}
          tick={{ fontSize: 12 }}
          stroke={isDarkMode ? "#9ca3af" : "#6b7280"} 
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {stackKeys.map((key) => (
          <Bar 
            key={key}
            dataKey={key} 
            stackId="a" 
            fill={barColors[key] || `#${Math.floor(Math.random()*16777215).toString(16)}`}
            name={key}
          >
            {/* Pass segment key and processedData to the label renderer */}
            <LabelList 
              content={(labelProps) => renderCustomizedLabel(labelProps, key, processedData)}
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default HorizontalPercentageBarChart;