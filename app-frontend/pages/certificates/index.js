const { getAccidentList, getAccidentStatistics, getAppealWindow } = require('../../services/accident');
const { getCertificateDetail, getCertificateThumbnail } = require('../../services/certificate');
const { getAppealByAccidentId } = require('../../services/appeal');

const statusMap = {
  pending: { label: '处理中', cls: 'tag-warning' },
  processing: { label: '处理中', cls: 'tag-warning' },
  manual_review: { label: '人工复核中', cls: 'tag-warning' },
  completed: { label: '已定责', cls: 'tag-success' },
  closed: { label: '已完结', cls: 'tag-info' },
};

Page({
  data: {
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '处理中' },
      { key: 'processing', label: '已定责' },
      { key: 'completed', label: '已完结' },
    ],
    keyword: '',
    accidents: [],
    loading: false,
    statistics: { total: 0, pending: 0, processing: 0, completed: 0 },
    page: 1,
    pageSize: 10,
    total: 0,
  },

  onLoad() {
    this.loadStatistics();
    this.loadData();
  },

  onShow() {
    this.loadStatistics();
    this.loadData();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, accidents: [] });
    this.loadStatistics();
    this.loadData();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.list >= this.data.total) return;
    this.setData({ page: this.data.page + 1 });
    this.loadData(true);
  },

  loadStatistics() {
    getAccidentStatistics()
      .then((stats) => {
        this.setData({ statistics: stats || this.data.statistics });
      })
      .catch(() => {});
  },

  loadData(append = false) {
    this.setData({ loading: true });
    const status = this.data.activeTab === 'all' ? '' : this.data.activeTab;
    getAccidentList({
      status,
      keyword: this.data.keyword,
      page: this.data.page,
      pageSize: this.data.pageSize,
    })
      .then((res) => {
        const rawList = (res && res.list) || [];
        const list = rawList.map(this._mapAccident.bind(this));
        this.setData({
          accidents: append ? this.data.accidents.concat(list) : list,
          total: res && res.total ? res.total : list.length,
          loading: false,
        });
        list.forEach((a) => {
          if (a.certificateId && !a.thumbnailUrl) {
            this._loadThumbnail(a.id, a.certificateId);
          }
          if (a.status === 'completed') {
            this._loadAppealInfo(a.id);
            this._loadAppealWindow(a.id);
          }
        });
      })
      .catch((err) => {
        console.error('[MyAccidents] 加载失败:', err);
        this.setData({ loading: false, accidents: [] });
      });
  },

  _mapAccident(acc) {
    const vehicles = acc.vehicles || [];
    const parties = vehicles
      .map((v) => (v.ownerName || '当事人') + ' · ' + (v.plateNo || ''))
      .filter(Boolean);
    const liability = (acc.liabilityResult && acc.liabilityResult.liabilityDescription) || '';
    const st = statusMap[acc.status] || { label: acc.status, cls: 'tag-warning' };
    const cert = acc.certificate || null;
    const certificateId = cert ? cert.id : (acc.certificateId || null);
    const thumbnailUrl = cert ? cert.thumbnailUrl : null;
    const pdfUrl = cert ? cert.pdfUrl : null;
    return {
      id: acc.id,
      reportNo: acc.reportNo,
      accidentTime: acc.occurTime,
      location: acc.location,
      partyA: parties[0] || '',
      partyB: parties[1] || '',
      parties,
      liability,
      status: acc.status,
      statusText: st.label,
      statusCls: st.cls,
      createdAt: acc.createdAt,
      certificateId,
      certificateNo: cert ? cert.certificateNo : '',
      templateType: cert ? cert.templateType : '',
      thumbnailUrl,
      pdfUrl,
      canAppeal: null,
      appealWindowText: '',
      existingAppeal: null,
    };
  },

  _loadThumbnail(accidentId, certificateId) {
    if (!certificateId) return;
    getCertificateThumbnail(certificateId)
      .then((res) => {
        if (!res || !res.url) return;
        const accidents = this.data.accidents.slice();
        const i = accidents.findIndex((a) => a.id === accidentId);
        if (i >= 0) {
          accidents[i].thumbnailUrl = res.url;
          this.setData({ accidents });
        }
      })
      .catch(() => {});
  },

  _loadAppealInfo(accidentId) {
    getAppealByAccidentId(accidentId)
      .then((appeal) => {
        if (!appeal) return;
        const accidents = this.data.accidents.slice();
        const i = accidents.findIndex((a) => a.id === accidentId);
        if (i >= 0) {
          accidents[i].existingAppeal = appeal;
          this.setData({ accidents });
        }
      })
      .catch(() => {});
  },

  _loadAppealWindow(accidentId) {
    getAppealWindow(accidentId)
      .then((w) => {
        const accidents = this.data.accidents.slice();
        const i = accidents.findIndex((a) => a.id === accidentId);
        if (i >= 0) {
          accidents[i].canAppeal = !!w.canAppeal;
          if (w.canAppeal) {
            accidents[i].appealWindowText = '剩余 ' + (w.remainingHours || 0) + ' 小时';
          } else {
            accidents[i].appealWindowText = w.reason || '';
          }
          this.setData({ accidents });
        }
      })
      .catch(() => {});
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key, page: 1, accidents: [] });
    this.loadData();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  doSearch() {
    this.setData({ page: 1, accidents: [] });
    this.loadData();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/accident-detail/index?id=' + id });
  },

  goToCertificate(e) {
    const { id, cid } = e.currentTarget.dataset;
    if (cid) {
      wx.navigateTo({ url: '/pages/certificate-detail/index?id=' + cid });
    } else {
      wx.navigateTo({ url: '/pages/accident-detail/index?id=' + id });
    }
  },

  goToAppeal(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/appeal/index?accidentId=' + id });
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/verify/index' });
  },

  onShareAppMessage() {
    return {
      title: '交通事故快速处理 · 我的事故',
      path: '/pages/home/index',
    };
  },
});
