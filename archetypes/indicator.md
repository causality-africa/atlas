---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
summary: ""
date: {{ .Date }}
type: indicator
---

{{< chart
    type="line"
    title=""
    description=""
    indicator=""
    unit=""
    time-start="1950-01-01"
    time-end="2030-12-31"
    region="AFR"
    locations="BW,CD,EG,GH,KE,MU,NG,RW,TD,ZA"
>}}

{{< table
    title=""
    indicators=""
    units=""
    time-start="1950-01-01"
    time-end="2030-12-31"
    region="AFR"
>}}
