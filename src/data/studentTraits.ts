export type StudentStatKey = 'diligence' | 'talent' | 'luck' | 'stress' | 'mentalState'

type StatBounds = Partial<Record<StudentStatKey, [number, number]>>

type TraitPolarity = 'positive' | 'negative' | 'neutral'

export type TraitCategory = 'main' | 'sub'

export type StudentTrait = {
  id: string
  name: string
  polarity: TraitPolarity
  category: TraitCategory
  description: string
  statBounds?: StatBounds
  conflicts?: string[]
}

export const studentTraits: StudentTrait[] = [
  {
    id: 'koi',
    name: '\u9526\u9ca4',
    polarity: 'positive',
    category: 'main',
    description: '\u8fd0\u6c14\u578b\u4eba\u683c\uff0c\u7ecf\u5e38\u8e52\u4e2d\u597d\u8fd0\u548c\u610f\u5916\u52a9\u529b\u3002',
    statBounds: { luck: [70, 100] },
    conflicts: ['jinx'],
  },
  {
    id: 'ouhuang',
    name: '\u6b27\u7687',
    polarity: 'positive',
    category: 'main',
    description: '\u8fd0\u6c14\u62c5\u5f53\uff0c\u5173\u952e\u8282\u70b9\u5bb9\u6613\u9006\u98ce\u7ffb\u76d8\u3002',
    statBounds: { luck: [85, 100] },
    conflicts: ['jinx'],
  },
  {
    id: 'workaholic',
    name: '\u5377\u738b',
    polarity: 'positive',
    category: 'main',
    description: '\u9ad8\u6fc0\u80fd\u578b\uff0c\u62fc\u547d\u4e5f\u8981\u628a\u6b65\u8c03\u8d70\u5728\u524d\u9762\u3002',
    statBounds: { diligence: [80, 100], stress: [50, 100] },
    conflicts: ['slacker'],
  },
  {
    id: 'genius',
    name: '\u5b66\u9738',
    polarity: 'positive',
    category: 'main',
    description: '\u5b66\u672f\u6c14\u8d28\u660e\u663e\uff0c\u63a8\u7406\u548c\u7206\u53d1\u80fd\u529b\u540c\u65f6\u5728\u7ebf\u3002',
    statBounds: { talent: [80, 100] },
    conflicts: ['average'],
  },
  {
    id: 'steady',
    name: '\u7a33\u5065\u6d3e',
    polarity: 'positive',
    category: 'main',
    description: '\u7a33\u5982\u6cf0\u5c71\uff0c\u8282\u594f\u4e0d\u4e71\uff0c\u9002\u5408\u7a33\u5b9a\u63a8\u8fdb\u3002',
    statBounds: { mentalState: [70, 95] },
    conflicts: ['volatile'],
  },
  {
    id: 'social',
    name: '\u793e\u4ea4\u8fbe\u4eba',
    polarity: 'positive',
    category: 'main',
    description: '\u5173\u7cfb\u7f51\u7edc\u6781\u5177\u5f39\u6027\uff0c\u8d44\u6e90\u548c\u5408\u4f5c\u90fd\u8ddf\u5f97\u4e0a\u3002',
    statBounds: { mentalState: [60, 90] },
  },
  {
    id: 'coachable',
    name: '\u597d\u5e26',
    polarity: 'positive',
    category: 'main',
    description: '\u98ce\u683c\u914d\u5408\uff0c\u65b0\u6280\u80fd\u4e0a\u624b\u5feb\uff0c\u6d3d\u6307\u5bfc\u3002',
    statBounds: { diligence: [60, 90] },
    conflicts: ['stubborn'],
  },
  {
    id: 'creative',
    name: '\u7075\u611f\u578b',
    polarity: 'neutral',
    category: 'main',
    description: '\u70b9\u5b50\u591a\uff0c\u6784\u601d\u6d3b\uff0c\u9700\u8981\u7a33\u5b9a\u7f16\u6392\u3002',
    statBounds: { talent: [60, 90] },
  },
  {
    id: 'pragmatic',
    name: '\u52a1\u5b9e\u6d3e',
    polarity: 'neutral',
    category: 'main',
    description: '\u6b65\u5b50\u8e0f\u5b9e\uff0c\u9002\u5408\u505a\u9898\u8bbe\u3001\u5de5\u7a0b\u5316\u8425\u9020\u3002',
    statBounds: { diligence: [55, 85] },
  },
  {
    id: 'rebel',
    name: '\u7279\u7acb\u72ec\u884c',
    polarity: 'neutral',
    category: 'main',
    description: '\u5f3a\u70c8\u4e2a\u4eba\u98ce\u683c\uff0c\u65b0\u8def\u7ebf\u5e38\u5e38\u4e0d\u8d70\u5e38\u8def\u3002',
    statBounds: { talent: [55, 85] },
  },
  {
    id: 'average',
    name: '\u8d44\u8d28\u5e73\u5e73',
    polarity: 'negative',
    category: 'main',
    description: '\u8be5\u6709\u7684\u90fd\u6709\uff0c\u4f46\u6d3b\u8dc3\u5ea6\u4e0d\u9ad8\u3002',
    statBounds: { talent: [30, 55] },
    conflicts: ['genius'],
  },
  {
    id: 'jinx',
    name: '\u5012\u9709\u86cb',
    polarity: 'negative',
    category: 'main',
    description: '\u5bb9\u6613\u8e29\u5751\uff0c\u6a21\u578b\u548c\u6d41\u7a0b\u7684\u7a81\u53d1\u60c5\u51b5\u66f4\u591a\u3002',
    statBounds: { luck: [0, 30] },
    conflicts: ['koi', 'ouhuang'],
  },
  {
    id: 'volatile',
    name: '\u5fc3\u6001\u4e0d\u7a33',
    polarity: 'negative',
    category: 'main',
    description: '\u73b0\u72b6\u6ce2\u52a8\uff0c\u9700\u8981\u9891\u7e41\u6b63\u5411\u56fa\u5b9a\u3002',
    statBounds: { mentalState: [30, 60] },
    conflicts: ['steady'],
  },
  {
    id: 'stubborn',
    name: '\u56fa\u6267\u5df1\u89c1',
    polarity: 'negative',
    category: 'main',
    description: '\u59ff\u6001\u5f3a\u786c\uff0c\u9700\u8981\u66f4\u957f\u65f6\u95f4\u6295\u5165\u3002',
    statBounds: { mentalState: [40, 70] },
    conflicts: ['coachable'],
  },
  {
    id: 'slacker',
    name: '\u6478\u9c7c',
    polarity: 'negative',
    category: 'main',
    description: '\u8282\u594f\u6162\uff0c\u591a\u6709\u5ef6\u8bef\uff0c\u9700\u8981\u80fd\u529b\u62c9\u7d27\u3002',
    statBounds: { diligence: [20, 50] },
    conflicts: ['workaholic'],
  },
  {
    id: 'perpetual',
    name: '\u5185\u5377\u6c38\u52a8\u673a',
    polarity: 'positive',
    category: 'sub',
    description: '\u5de5\u4f5c\u72b6\u6001\u4e0d\u4f1a\u540e\u9000\uff0c\u7ecf\u5e38\u81ea\u6211\u52a0\u901f\u3002',
  },
  {
    id: 'nightcoder',
    name: '\u6df1\u591c\u4fee\u590d\u4fa0',
    polarity: 'neutral',
    category: 'sub',
    description: '\u4e0d\u505a\u9ad8\u6210\u672c\u7684\u65e5\u95f4\u4fee\u590d\uff0c\u51cc\u6668\u88ab\u901a\u77e5\u624d\u6709\u5f55\u97f3\u3002',
  },
  {
    id: 'pptmaster',
    name: '\u5e7b\u706f\u7247\u5927\u5e08',
    polarity: 'neutral',
    category: 'sub',
    description: '\u7ec4\u4f1a\u4e00\u5b9a\u6709\u8bbe\u8ba1\u611f\uff0c\u914d\u8272\u548c\u7ed3\u6784\u90fd\u8bf4\u5f97\u8fc7\u53bb\u3002',
  },
  {
    id: 'coffee',
    name: '\u5561\u5561\u7eed\u547d',
    polarity: 'neutral',
    category: 'sub',
    description: '\u9760\u5496\u5561\u6ee1\u8840\uff0c\u8282\u594f\u548c\u8f6c\u8f6c\u80fd\u4e0a\u7ebf\u3002',
  },
  {
    id: 'luckycat',
    name: '\u7384\u5b66\u8f6c\u8fd0\u5bb6',
    polarity: 'neutral',
    category: 'sub',
    description: '\u80fd\u7ed9\u81ea\u5df1\u8bbe\u4e2a\u8fd0\u6c14\u5f15\u64ce\uff0c\u6b63\u786e\u987a\u5e8f\u4e0d\u91cd\u6784\u3002',
  },
  {
    id: 'bughunter',
    name: 'Bug\u53ec\u5524\u8005',
    polarity: 'negative',
    category: 'sub',
    description: '\u4ee3\u7801\u603b\u80fd\u633a\u51fa\u610f\u5916\u95ee\u9898\uff0c\u4f46\u4e5f\u4f1a\u4f7f\u4eba\u6709\u6545\u4e8b\u8bf4\u3002',
  },
  {
    id: 'deadline',
    name: '\u6b7b\u7ebf\u6218\u795e',
    polarity: 'neutral',
    category: 'sub',
    description: '\u4f1a\u5728\u6700\u540e\u51e0\u5929\u7206\u53d1\uff0c\u5e38\u5e38\u628a\u7ecf\u9a8c\u5199\u8fdb\u751f\u6d3b\u3002',
  },
  {
    id: 'overthink',
    name: '\u8111\u5185\u98ce\u66b4',
    polarity: 'negative',
    category: 'sub',
    description: '\u60f3\u5f88\u591a\uff0c\u9700\u8981\u66f4\u6e05\u6670\u7684\u5b9e\u9a8c\u8def\u7ebf\u56fe\u3002',
  },
  {
    id: 'toughsoft',
    name: '\u5634\u786c\u5fc3\u8f6f',
    polarity: 'neutral',
    category: 'sub',
    description: '\u8868\u9762\u4e0a\u4e0d\u592a\u59a5\u534f\uff0c\u4f46\u603b\u4f1a\u9ed8\u9ed8\u625b\u8d23\u548c\u5e2e\u5fd9\u3002',
  },
  {
    id: 'tidy',
    name: '\u684c\u9762\u6d01\u7656',
    polarity: 'neutral',
    category: 'sub',
    description: '\u6587\u4ef6\u5206\u7c7b\u6709\u7ae0\u6cd5\uff0c\u5bf9\u901a\u9053\u548c\u8d44\u6e90\u6574\u7406\u6709\u5929\u8d4b\u3002',
  },
]
