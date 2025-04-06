---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
summary: ""
date: {{ .Date }}
type: chart
---

{{< chart
    type="line"
    title=""
    description="."
    indicator=""
    time-start="1950"
    time-end="2031"
    locations="BW,CD,EG,GH,KE,MU,NG,RW,TD,ZA"
>}}
